const express = require('express');
const router = express.Router();
const ExaminerRequest = require('../models/ExaminerRequest');
const { authMiddleware } = require('../middleware/auth');

// Create Examiner Hospitality & Accommodation Request (HOD -> AO)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      purpose,
      examSubject,
      examDateFrom,
      examDateTo,
      examiners,
      accommodation,
      food,
      conveyance,
      specialInstructions
    } = req.body;

    if (!examSubject || !examDateFrom || !examiners || examiners.length === 0) {
      return res.status(400).json({ message: 'Examiner name, exam subject, and dates are required' });
    }

    const newRequest = new ExaminerRequest({
      hod: req.user._id,
      hodName: req.user.name,
      department: req.user.department || 'General',
      purpose: purpose || 'End Semester Practical / Lab Examination',
      examSubject,
      examDateFrom,
      examDateTo: examDateTo || examDateFrom,
      examiners,
      accommodation: accommodation || {
        required: true,
        roomCount: 1,
        roomType: 'Executive AC Guest Suite',
        checkInDate: examDateFrom,
        checkInTime: '08:00 AM',
        checkOutDate: examDateTo || examDateFrom,
        checkOutTime: '06:00 PM',
        allocatedRoom: 'Pending AO Allocation'
      },
      food: food || {
        breakfast: { required: true, count: examiners.length + 1, notes: 'South Indian Breakfast with Coffee' },
        morningTea: { required: true, count: examiners.length + 2, time: '11:00 AM', withSnacks: true },
        lunch: { required: true, count: examiners.length + 2, mealType: 'Special Executive Meals', vegCount: examiners.length + 1, nonVegCount: 1, notes: '' },
        eveningTea: { required: true, count: examiners.length + 2, time: '04:00 PM', withSnacks: true },
        dinner: { required: false, count: 0, notes: '' }
      },
      conveyance: conveyance || {
        pickupRequired: false,
        pickupLocation: '',
        pickupTime: '',
        dropRequired: false
      },
      specialInstructions: specialInstructions || '',
      status: 'PENDING'
    });

    await newRequest.save();
    res.status(201).json({ 
      message: 'Requisition submitted successfully to Administrative Officer (AO)',
      request: newRequest 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting hospitality request', error: err.message });
  }
});

const mongoose = require('mongoose');
const { mockExaminerRequests } = require('../fallbackStore');

// Get requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, department } = req.query;
    let query = {};

    if (status) query.status = status;
    if (department) query.department = department;

    // HOD sees only their department's requests
    if (req.user.role === 'HOD') {
      query.hod = req.user._id;
    }
    // AO and others can view all

    if (mongoose.connection.readyState === 1) {
      const requests = await ExaminerRequest.find(query)
        .populate('hod', 'name email department phone')
        .populate('aoOfficer', 'name email designation phone')
        .sort({ createdAt: -1 });

      return res.json({ requests });
    }

    let list = [...mockExaminerRequests];
    if (req.user.role === 'HOD') {
      list = list.filter(r => r.hod === req.user._id);
    }
    if (status) {
      list = list.filter(r => r.status === status);
    }
    res.json({ requests: list });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching hospitality requests', error: err.message });
  }
});

// Get single request
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const request = await ExaminerRequest.findById(req.params.id)
      .populate('hod', 'name email department phone')
      .populate('aoOfficer', 'name email designation phone');

    if (!request) {
      return res.status(404).json({ message: 'Hospitality request not found' });
    }
    res.json({ request });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving request', error: err.message });
  }
});

// AO Approve or Reject Request
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, aoRemarks, allocatedRoom } = req.body;
    
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED' });
    }

    if (req.user.role !== 'AO') {
      return res.status(403).json({ message: 'Access denied: Only Administrative Officer (AO) can approve or reject external examiner requisitions' });
    }

    const request = await ExaminerRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Hospitality request not found' });
    }

    request.status = status;
    request.aoRemarks = aoRemarks || (status === 'APPROVED' ? 'Sanctioned and catering arrangements notified to canteen supervisor.' : 'Requisition could not be approved due to administrative constraints.');
    request.actionDate = new Date();
    request.aoOfficer = req.user._id;

    if (status === 'APPROVED') {
      if (allocatedRoom) {
        request.accommodation.allocatedRoom = allocatedRoom;
      } else if (request.accommodation.required && (!request.accommodation.allocatedRoom || request.accommodation.allocatedRoom.includes('Pending'))) {
        request.accommodation.allocatedRoom = 'Room 201 - Executive Suite, NEC Campus Guest House';
      }
      
      if (!request.sanctionOrderNo) {
        const serial = Math.floor(100 + Math.random() * 900);
        request.sanctionOrderNo = `NEC/AO/SANCT/${new Date().getFullYear()}/${serial}`;
      }
    }

    await request.save();
    res.json({ 
      message: `Hospitality requisition ${status.toLowerCase()} by Administrative Officer`, 
      request 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error processing AO requisition status', error: err.message });
  }
});

module.exports = router;
