const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'nec_secret_key_2026';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    let user;
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      user = await User.findById(decoded.id).populate('assignedHall');
    } else {
      const { findMockUserById } = require('../fallbackStore');
      const mockU = findMockUserById(decoded.id);
      if (mockU) {
        user = { ...mockU, save: async () => {} };
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Support active role switching if user has multiple roles (e.g. HOD + COORDINATOR)
    const activeRoleHeader = req.headers['x-active-role'];
    if (activeRoleHeader && (user.roles?.includes(activeRoleHeader) || user.role === activeRoleHeader)) {
      user.role = activeRoleHeader;
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token', error: err.message });
  }
};

module.exports = { authMiddleware, JWT_SECRET };
