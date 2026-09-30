const express = require('express');
const router = express.Router();
const StationaryRequest = require('../models/StationaryRequest');
const { authMiddleware } = require('../middleware/auth');

// 1. Create Stationery Requisition (HOD / Faculty / Coordinator -> AO)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      purpose,
      urgency,
      requiredByDate,
      items,
      generalRemarks
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one stationery item is required in the requisition' });
    }

    if (!requiredByDate) {
      return res.status(400).json({ message: 'Required-by date is required' });
    }

    // Validate item entries
    const sanitizedItems = items.map(item => ({
      itemName: item.itemName?.trim(),
      category: item.category || 'General Stationery',
      quantityRequested: Number(item.quantityRequested) || 1,
      quantitySanctioned: null,
      unit: item.unit || 'Pieces / Nos',
      specification: item.specification || ''
    })).filter(item => Boolean(item.itemName));

    if (sanitizedItems.length === 0) {
      return res.status(400).json({ message: 'Valid item names and quantities must be specified' });
    }

    const newRequest = new StationaryRequest({
      department: req.user.department || 'General Academic',
      requestedBy: req.user._id,
      requestorName: req.user.name,
      requestorDesignation: req.user.designation || (req.user.role === 'HOD' ? 'Head of Department' : 'Faculty / Coordinator'),
      purpose: purpose || 'General Departmental Use',
      urgency: urgency || 'ROUTINE',
      requiredByDate,
      items: sanitizedItems,
      generalRemarks: generalRemarks || '',
      status: 'PENDING'
    });

    await newRequest.save();

    res.status(201).json({
      message: 'Stationery requisition submitted successfully to Administrative Officer (AO)',
      request: newRequest
    });
  } catch (err) {
    console.error('[Stationary Route Error]', err);
    res.status(500).json({ message: 'Error submitting stationery requisition', error: err.message });
  }
});

// 2. Get Stationery Requisitions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, department, urgency } = req.query;
    let query = {};

    if (status && status !== 'ALL') query.status = status;
    if (department && department !== 'ALL') query.department = department;
    if (urgency && urgency !== 'ALL') query.urgency = urgency;

    // HOD and Coordinator see their own department's requisitions
    if (req.user.role === 'HOD') {
      query.requestedBy = req.user._id;
    }
    // AO sees all requests across all departments

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const requests = await StationaryRequest.find(query)
        .populate('requestedBy', 'name email department designation phone')
        .populate('aoOfficer', 'name email designation phone')
        .sort({ createdAt: -1 });

      return res.json({ requests });
    }

    const { mockStationaryRequests } = require('../fallbackStore');
    let list = [...mockStationaryRequests];
    if (req.user.role === 'HOD') {
      list = list.filter(r => r.requestedBy === req.user._id);
    }
    res.json({ requests: list });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving stationery requisitions', error: err.message });
  }
});

// 3. Get single requisition
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const request = await StationaryRequest.findById(req.params.id)
      .populate('requestedBy', 'name email department designation phone')
      .populate('aoOfficer', 'name email designation phone');

    if (!request) {
      return res.status(404).json({ message: 'Stationery requisition not found' });
    }
    res.json({ request });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving stationery requisition', error: err.message });
  }
});

// 4. AO Update Status (Approve, Reject, Issue)
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, aoRemarks, itemsSanctioned } = req.body;

    if (!['APPROVED', 'REJECTED', 'ISSUED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be APPROVED, REJECTED, or ISSUED' });
    }

    if (req.user.role !== 'AO') {
      return res.status(403).json({ message: 'Access denied: Only the Administrative Officer (AO) can sanction or issue stationery' });
    }

    const request = await StationaryRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Stationery requisition not found' });
    }

    request.status = status;
    request.actionDate = new Date();
    request.aoOfficer = req.user._id;

    if (aoRemarks !== undefined) {
      request.aoRemarks = aoRemarks;
    } else if (status === 'APPROVED' && !request.aoRemarks) {
      request.aoRemarks = 'Sanctioned from Central Store. Collect from Storekeeper (Room 104, Admin Block).';
    } else if (status === 'REJECTED' && !request.aoRemarks) {
      request.aoRemarks = 'Unable to sanction due to current stock replenishment schedule.';
    } else if (status === 'ISSUED' && !request.aoRemarks) {
      request.aoRemarks = 'Stationery items issued from Central Store inventory to department representative.';
    }

    // Handle sanctioned quantities for items
    if (status === 'APPROVED' || status === 'ISSUED') {
      if (itemsSanctioned && Array.isArray(itemsSanctioned)) {
        // Map sanctioned counts by item id or index
        request.items.forEach((it, idx) => {
          const match = itemsSanctioned.find(si => (si._id && String(si._id) === String(it._id)) || si.index === idx);
          if (match && match.quantitySanctioned !== undefined) {
            it.quantitySanctioned = Number(match.quantitySanctioned);
          } else if (it.quantitySanctioned === null || it.quantitySanctioned === undefined) {
            it.quantitySanctioned = it.quantityRequested;
          }
        });
      } else {
        // Default all items to full requested quantity if not already set
        request.items.forEach(it => {
          if (it.quantitySanctioned === null || it.quantitySanctioned === undefined) {
            it.quantitySanctioned = it.quantityRequested;
          }
        });
      }

      // Generate Sanction Order Number if not yet assigned
      if (!request.sanctionOrderNo) {
        const serial = Math.floor(100 + Math.random() * 900);
        request.sanctionOrderNo = `NEC/AO/STAT/${new Date().getFullYear()}/${serial}`;
      }

      if (status === 'ISSUED') {
        request.dispatchedAt = new Date();
      }
    }

    await request.save();

    res.json({
      message: `Stationery requisition successfully updated to ${status}`,
      request
    });
  } catch (err) {
    console.error('[Stationary Status Update Error]', err);
    res.status(500).json({ message: 'Error updating stationery requisition', error: err.message });
  }
});

// 5. Delete / Cancel pending requisition
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const request = await StationaryRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Stationery requisition not found' });
    }

    // Only owner or AO can delete/cancel
    const isOwner = String(request.requestedBy) === String(req.user._id);
    const isAO = req.user.role === 'AO';

    if (!isOwner && !isAO) {
      return res.status(403).json({ message: 'Access denied to cancel this requisition' });
    }

    if (request.status !== 'PENDING' && !isAO) {
      return res.status(400).json({ message: 'Only PENDING requisitions can be cancelled by the department' });
    }

    await StationaryRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Stationery requisition deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting stationery requisition', error: err.message });
  }
});

module.exports = router;
