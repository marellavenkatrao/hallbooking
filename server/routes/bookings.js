const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const HallBooking = require('../models/HallBooking');
const SeminarHall = require('../models/SeminarHall');
const { authMiddleware } = require('../middleware/auth');
const { mockHalls, mockBookings } = require('../fallbackStore');

// Helper to get local date string YYYY-MM-DD
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Create a hall booking request (HOD)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      hallId,
      eventName,
      eventType,
      date,
      fromDate,
      toDate,
      slot,
      startTime,
      endTime,
      expectedAudience,
      chiefGuest,
      requirements
    } = req.body;

    const effectiveFromDate = fromDate || date;
    const effectiveToDate = toDate || effectiveFromDate;

    if (!hallId || !eventName || !effectiveFromDate || !slot) {
      return res.status(400).json({ message: 'Please provide all required booking fields (Hall, Event Name, Date, Slot)' });
    }

    // 1. Date Validation: date must be greater than or equal to today
    const todayStr = getLocalDateString();
    if (effectiveFromDate < todayStr) {
      return res.status(400).json({ 
        message: `Booking date cannot be in the past. Date (${effectiveFromDate}) must be greater than or equal to today (${todayStr}).` 
      });
    }

    // 2. Multiple days validation: toDate cannot be earlier than fromDate
    if (effectiveToDate < effectiveFromDate) {
      return res.status(400).json({ 
        message: `Invalid date range. End Date (${effectiveToDate}) cannot be earlier than Start Date (${effectiveFromDate}).` 
      });
    }

    // Robust Hall Lookup (by ObjectId, Code 'BLOCK-2', or shorthand 'b2')
    let hall = null;
    if (mongoose.connection.readyState === 1) {
      if (mongoose.isValidObjectId(hallId)) {
        hall = await SeminarHall.findById(hallId);
      }
    } else {
      hall = mockHalls.find(h => h._id === hallId || h.code === hallId);
    }
    
    if (!hall && mongoose.connection.readyState === 1) {
      const codeStr = hallId.toString().trim().toUpperCase();
      const normalizedCode = codeStr.startsWith('BLOCK-') ? codeStr : `BLOCK-${codeStr.replace(/[^0-9]/g, '')}`;
      hall = await SeminarHall.findOne({
        $or: [
          { code: codeStr },
          { code: normalizedCode },
          { name: new RegExp(codeStr.replace('-', ' '), 'i') }
        ]
      });
    } else if (!hall) {
      const codeStr = hallId.toString().trim().toUpperCase();
      hall = mockHalls.find(h => h.name.toUpperCase().includes(codeStr) || h.code === codeStr);
    }

    if (!hall) {
      return res.status(404).json({ message: 'Seminar hall not found. Please select Block-2, Block-3, or Block-4.' });
    }

    const resolvedHallId = hall._id;

    // Clash detection: check if an APPROVED booking exists for this hall overlapping with [effectiveFromDate, effectiveToDate]
    const slotConflictConditions = [
      { slot: slot },
      { slot: 'FULL_DAY' }
    ];
    if (slot === 'FULL_DAY') {
      slotConflictConditions.push({ slot: 'FN' }, { slot: 'AN' });
    }

    if (mongoose.connection.readyState === 1) {
      const conflict = await HallBooking.findOne({
        hall: resolvedHallId,
        status: 'APPROVED',
        $or: slotConflictConditions,
        $and: [
          {
            $or: [
              { fromDate: { $lte: effectiveToDate } },
              { date: { $lte: effectiveToDate } }
            ]
          },
          {
            $or: [
              { toDate: { $gte: effectiveFromDate } },
              { date: { $gte: effectiveFromDate } }
            ]
          }
        ]
      });

      if (conflict) {
        const conflictDateRange = (conflict.fromDate && conflict.toDate && conflict.fromDate !== conflict.toDate)
          ? `${conflict.fromDate} to ${conflict.toDate}`
          : (conflict.date || conflict.fromDate);
        return res.status(409).json({ 
          message: `Seminar Hall is already booked and approved for '${conflict.eventName}' (${conflict.slot}) on ${conflictDateRange}`,
          conflict
        });
      }
    }

    const isMultiDay = effectiveFromDate !== effectiveToDate;

    const newBooking = new HallBooking({
      hall: resolvedHallId,
      hallName: hall.name,
      hod: req.user._id,
      hodName: req.user.name,
      department: req.user.department || 'General',
      eventName,
      eventType: eventType || 'Guest Lecture',
      date: effectiveFromDate,
      fromDate: effectiveFromDate,
      toDate: effectiveToDate,
      isMultiDay,
      slot,
      startTime: startTime || (slot === 'FN' ? '09:30 AM' : slot === 'AN' ? '01:30 PM' : '09:30 AM'),
      endTime: endTime || (slot === 'FN' ? '12:30 PM' : slot === 'AN' ? '04:30 PM' : '04:30 PM'),
      expectedAudience: Number(expectedAudience) || 100,
      chiefGuest: chiefGuest || '',
      requirements: requirements || {
        projector: true,
        soundSystem: true,
        airConditioning: true,
        podiumMic: true,
        videoRecording: false,
        specialArrangements: ''
      },
      status: 'PENDING',
      coordinator: hall.coordinator
    });

    if (mongoose.connection.readyState === 1) {
      await newBooking.save();
    } else {
      mockBookings.unshift(newBooking.toObject ? newBooking.toObject() : newBooking);
    }

    res.status(201).json({ 
      message: `Booking request successfully submitted to Coordinator (${hall.coordinatorName})`, 
      booking: newBooking 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating hall booking', error: err.message });
  }
});

// Get bookings with role-based filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, hallId, date } = req.query;
    let query = {};

    if (status) query.status = status;
    if (hallId) query.hall = hallId;
    if (date) query.date = date;

    if (req.user.role === 'HOD') {
      // HOD sees their own department's requests
      query.hod = req.user._id;
    } else if (req.user.role === 'COORDINATOR') {
      // Coordinator sees requests for their assigned hall
      if (req.user.assignedHall) {
        query.hall = req.user.assignedHall._id || req.user.assignedHall;
      }
    }
    // AO and Admin can view all bookings

    if (mongoose.connection.readyState === 1) {
      const bookings = await HallBooking.find(query)
        .populate('hall')
        .populate('hod', 'name email department phone')
        .populate('coordinator', 'name email phone')
        .sort({ createdAt: -1 });

      return res.json({ bookings });
    }

    let list = [...mockBookings];
    if (req.user.role === 'HOD') {
      list = list.filter(b => b.hod === req.user._id || b.department === req.user.department);
    } else if (req.user.role === 'COORDINATOR') {
      if (req.user.assignedHall) {
        const hId = req.user.assignedHall._id || req.user.assignedHall;
        list = list.filter(b => b.hall === hId);
      }
    }
    if (status) {
      list = list.filter(b => b.status === status);
    }
    res.json({ bookings: list });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving bookings', error: err.message });
  }
});

// Get single booking by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await HallBooking.findById(req.params.id)
      .populate('hall')
      .populate('hod', 'name email department phone')
      .populate('coordinator', 'name email phone');

    if (!booking) {
      return res.status(404).json({ message: 'Booking request not found' });
    }
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving booking details', error: err.message });
  }
});

// Approve or Reject booking (Coordinator)
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, coordinatorRemarks } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED' });
    }

    const booking = await HallBooking.findById(req.params.id).populate('hall');
    if (!booking) {
      return res.status(404).json({ message: 'Booking request not found' });
    }

    // Check permissions: only coordinator of this hall or AO/Admin
    const isCoordinator = req.user.role === 'COORDINATOR' || (req.user.roles && req.user.roles.includes('COORDINATOR'));
    if (isCoordinator) {
      const userAssignedHallId = (req.user.assignedHall?._id || req.user.assignedHall || '').toString();
      const bookingHallId = (booking.hall?._id || booking.hall).toString();
      if (userAssignedHallId && userAssignedHallId !== bookingHallId) {
        return res.status(403).json({ message: 'You are only authorized to review bookings for your assigned Seminar Hall' });
      }
    } else if (req.user.role !== 'AO') {
      return res.status(403).json({ message: 'Only Seminar Hall Coordinators or AO can approve or reject bookings' });
    }

    // If approving, re-check for clashes to ensure safety
    if (status === 'APPROVED') {
      const slotConflictConditions = [
        { slot: booking.slot },
        { slot: 'FULL_DAY' }
      ];
      if (booking.slot === 'FULL_DAY') {
        slotConflictConditions.push({ slot: 'FN' }, { slot: 'AN' });
      }

      const bookingFrom = booking.fromDate || booking.date;
      const bookingTo = booking.toDate || bookingFrom;

      const existingApproval = await HallBooking.findOne({
        _id: { $ne: booking._id },
        hall: booking.hall._id || booking.hall,
        status: 'APPROVED',
        $or: slotConflictConditions,
        $and: [
          {
            $or: [
              { fromDate: { $lte: bookingTo } },
              { date: { $lte: bookingTo } }
            ]
          },
          {
            $or: [
              { toDate: { $gte: bookingFrom } },
              { date: { $gte: bookingFrom } }
            ]
          }
        ]
      });

      if (existingApproval) {
        const conflictRange = (existingApproval.fromDate && existingApproval.toDate && existingApproval.fromDate !== existingApproval.toDate)
          ? `${existingApproval.fromDate} to ${existingApproval.toDate}`
          : (existingApproval.date || existingApproval.fromDate);
        return res.status(409).json({ 
          message: `Cannot approve: Hall is already confirmed for '${existingApproval.eventName}' on ${conflictRange}`,
          existingApproval 
        });
      }
    }

    booking.status = status;
    booking.coordinatorRemarks = coordinatorRemarks || (status === 'APPROVED' ? 'Approved by Seminar Hall Coordinator.' : 'Regret to inform, slot unavailable or reserved.');
    booking.actionDate = new Date();
    booking.coordinator = req.user._id;

    if (status === 'APPROVED') {
      const serial = Math.floor(1000 + Math.random() * 9000);
      booking.passNumber = `NEC/SH-PASS/${new Date().getFullYear()}/${serial}`;
      booking.passSentToHod = true;
      booking.passSentAt = new Date();
      booking.passViewedByHod = false;
      booking.coordinatorSignature = `${req.user.name} (${req.user.designation || 'Coordinator'})`;
    }

    await booking.save();

    res.json({ 
      message: status === 'APPROVED' 
        ? `Booking approved! Official Seminar Hall Pass (${booking.passNumber}) has been dispatched to ${booking.hodName}'s login.`
        : `Booking request declined.`, 
      booking 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating booking status', error: err.message });
  }
});

// Cancel a booking (Department HOD)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const booking = await HallBooking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking request not found' });
    }

    // Permission check: Department HOD who booked it or AO/Admin
    const isOwner = booking.hod.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'AO') {
      return res.status(403).json({ message: 'You are only authorized to cancel bookings placed by your department' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ message: 'This booking is already cancelled' });
    }

    if (mongoose.connection.readyState === 1) {
      booking.status = 'CANCELLED';
      booking.cancellationReason = cancellationReason || 'Cancelled by Department HOD';
      booking.cancelledAt = new Date();
      await booking.save();
    } else {
      const bk = mockBookings.find(b => b._id === req.params.id);
      if (bk) {
        bk.status = 'CANCELLED';
        bk.cancellationReason = cancellationReason || 'Cancelled by Department HOD';
        bk.cancelledAt = new Date();
      }
    }

    res.json({ 
      message: `Booking request '${booking.eventName}' has been successfully cancelled.`, 
      booking 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error cancelling booking', error: err.message });
  }
});

// Acknowledge / View Pass (HOD)
router.put('/:id/acknowledge-pass', authMiddleware, async (req, res) => {
  try {
    const booking = await HallBooking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking pass not found' });
    }
    booking.passViewedByHod = true;
    await booking.save();
    res.json({ message: 'Pass acknowledged', booking });
  } catch (err) {
    res.status(500).json({ message: 'Error acknowledging pass', error: err.message });
  }
});

module.exports = router;
