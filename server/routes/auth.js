const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { findMockUserByEmail, findMockUserById, mockUsers } = require('../fallbackStore');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    let user;
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ email: email.toLowerCase().trim() }).populate('assignedHall');
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials. User not found.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    } else {
      // In-memory fallback on Vercel if MongoDB Atlas connection is not yet configured
      user = findMockUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials. User not found.' });
      }
      if (password !== 'nec@123' && password !== 'password123') {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles?.length ? user.roles : [user.role],
        department: user.department,
        designation: user.designation,
        assignedHall: user.assignedHall,
        phone: user.phone,
        landline: user.landline
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login', error: err.message });
  }
});

// Quick login (by user ID)
router.post('/demo-login', async (req, res) => {
  try {
    const { userId } = req.body;
    let user;
    if (mongoose.connection.readyState === 1) {
      user = await User.findById(userId).populate('assignedHall');
    } else {
      user = findMockUserById(userId);
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles?.length ? user.roles : [user.role],
        department: user.department,
        designation: user.designation,
        assignedHall: user.assignedHall,
        phone: user.phone,
        landline: user.landline
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login', error: err.message });
  }
});

// Switch active role for dual-role users (e.g. HOD CSE <-> Block-2 Coordinator)
router.post('/switch-role', authMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = req.user.roles?.length ? req.user.roles : [req.user.role];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: `Access denied. Account is not registered for role '${role}'.` });
    }

    req.user.role = role;
    await req.user.save();

    res.json({
      message: `Active view switched to ${role}`,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        roles: req.user.roles,
        department: req.user.department,
        designation: req.user.designation,
        assignedHall: req.user.assignedHall,
        phone: req.user.phone,
        landline: req.user.landline
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to switch active role', error: err.message });
  }
});

// Current user profile
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      roles: req.user.roles?.length ? req.user.roles : [req.user.role],
      department: req.user.department,
      designation: req.user.designation,
      assignedHall: req.user.assignedHall,
      phone: req.user.phone,
      landline: req.user.landline
    }
  });
});

// Faculty & Coordinator Directory
router.get('/demo-users', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const users = await User.find({}, '-password').populate('assignedHall');
      return res.json({ users });
    }
    res.json({ users: mockUsers });
  } catch (err) {
    res.json({ users: mockUsers });
  }
});

router.get('/directory', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const users = await User.find({}, '-password').populate('assignedHall');
      return res.json({ users });
    }
    res.json({ users: mockUsers });
  } catch (err) {
    res.json({ users: mockUsers });
  }
});

module.exports = router;
