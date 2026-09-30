const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const hallRoutes = require('./routes/halls');
const bookingRoutes = require('./routes/bookings');
const examinerRequestRoutes = require('./routes/examinerRequests');
const stationaryRequestRoutes = require('./routes/stationaryRequests');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nec_portal';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/halls', hallRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/examiner-requests', examinerRequestRoutes);
app.use('/api/stationary-requests', stationaryRequestRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    portal: 'Narasaropeta Engineering College - Seminar Hall & AO Hospitality Portal',
    timestamp: new Date()
  });
});

// Database connection state caching for serverless environments
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    isConnected = true;
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to ${MONGODB_URI}`);
  } catch (err) {
    console.error('[MongoDB] Connection error:', err.message);
    throw err;
  }
};

// Database connection middleware for requests
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    return res.status(500).json({
      message: 'Database connection failed. Please ensure MONGODB_URI is accessible.',
      error: err.message
    });
  }
});

// Start local server if not running in a serverless context like Vercel
if (!process.env.VERCEL) {
  connectToDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] NEC Portal Backend running on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('[Server] Failed to connect to MongoDB on startup:', err.message);
  });
}

module.exports = app;
