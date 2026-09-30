const express = require('express');
const router = express.Router();
const SeminarHall = require('../models/SeminarHall');
const HallBooking = require('../models/HallBooking');

const mongoose = require('mongoose');
const { mockHalls, mockBookings } = require('../fallbackStore');

// Get all seminar halls
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const halls = await SeminarHall.find({ isActive: true }).populate('coordinator', 'name email phone designation');
      return res.json({ halls });
    }
    res.json({ halls: mockHalls });
  } catch (err) {
    res.json({ halls: mockHalls });
  }
});

// Check availability of halls for a given date
router.get('/availability', async (req, res) => {
  try {
    const { date, hallId } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date query parameter is required (YYYY-MM-DD)' });
    }

    let halls, bookings;
    if (mongoose.connection.readyState === 1) {
      const hallQuery = hallId ? { _id: hallId, isActive: true } : { isActive: true };
      halls = await SeminarHall.find(hallQuery).populate('coordinator', 'name email phone designation');

      const bookingQuery = {
        date: date,
        status: { $in: ['APPROVED', 'PENDING'] }
      };
      if (hallId) {
        bookingQuery.hall = hallId;
      }
      bookings = await HallBooking.find(bookingQuery).populate('hod', 'name department email phone');
    } else {
      halls = hallId ? mockHalls.filter(h => h._id === hallId) : mockHalls;
      bookings = mockBookings.filter(b => (b.date === date || (b.fromDate <= date && b.toDate >= date)) && ['APPROVED', 'PENDING'].includes(b.status));
    }

    // Build availability summary for each hall
    const availability = halls.map(hall => {
      const hallBookings = bookings.filter(b => b.hall.toString() === hall._id.toString());
      
      const fnBooking = hallBookings.find(b => b.slot === 'FN' || b.slot === 'FULL_DAY');
      const anBooking = hallBookings.find(b => b.slot === 'AN' || b.slot === 'FULL_DAY');
      const fullDayBooking = hallBookings.find(b => b.slot === 'FULL_DAY');

      return {
        hallId: hall._id,
        name: hall.name,
        code: hall.code,
        block: hall.block,
        capacity: hall.capacity,
        coordinatorName: hall.coordinatorName,
        facilities: hall.facilities,
        bookings: hallBookings,
        slots: {
          FN: {
            status: fnBooking ? (fnBooking.status === 'APPROVED' ? 'BOOKED' : 'PENDING_APPROVAL') : 'AVAILABLE',
            booking: fnBooking || null
          },
          AN: {
            status: anBooking ? (anBooking.status === 'APPROVED' ? 'BOOKED' : 'PENDING_APPROVAL') : 'AVAILABLE',
            booking: anBooking || null
          },
          FULL_DAY: {
            status: (fnBooking || anBooking) ? 'UNAVAILABLE' : 'AVAILABLE',
            booking: fullDayBooking || null
          }
        }
      };
    });

    res.json({ date, availability });
  } catch (err) {
    res.status(500).json({ message: 'Error checking hall availability', error: err.message });
  }
});

// Get single hall by ID
router.get('/:id', async (req, res) => {
  try {
    const hall = await SeminarHall.findById(req.params.id).populate('coordinator', 'name email phone designation');
    if (!hall) {
      return res.status(404).json({ message: 'Seminar hall not found' });
    }
    res.json({ hall });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching seminar hall', error: err.message });
  }
});

module.exports = router;
