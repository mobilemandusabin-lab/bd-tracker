const express = require('express');
const morgan = require('morgan');
const morganBody = require('morgan-body');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const leadRoutes = require('./routes/leadRoutes');
const activityRoutes = require('./routes/activityRoutes');
const path = require('path');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const goalRoutes = require('./routes/goalRoutes');
const taskRoutes = require('./routes/taskRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const nepalcanRoutes = require('./routes/nepalcanRoutes');
const nepalcanOrderRoutes = require('./routes/nepalcanOrderRoutes');
const pipelineStageRoutes = require('./routes/pipelineStageRoutes');
const vendorSnapshotRoutes = require('./routes/vendorSnapshotRoutes');
const deliveryZoneRoutes = require('./routes/deliveryZoneRoutes');
const extensionRoutes = require('./routes/extensionRoutes');
const roleRoutes = require('./routes/roleRoutes');
const teamTargetRoutes = require('./routes/teamTargetRoutes');
const financeRoutes = require('./routes/financeRoutes');
let aiRoutes;
if (process.env.GROQ_API_KEY) {
  aiRoutes = require('./routes/aiRoutes');
}

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or chrome extensions)
    if (!origin) return callback(null, true);
    // Allow all origins including chrome-extension://
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400
};

// Manual CORS headers — belt-and-suspenders with cors() package
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Middleware
app.use(compression());
app.use(morgan('dev'));
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.use(express.json());

// Connection-ready middleware — ensures MongoDB is connected before any
// route handler runs. On Vercel cold starts, connectDB() (fired from
// server.js at module load time) may still be completing when the first
// request arrives. Without this guard, Mongoose buffers queries for 10s
// (default bufferTimeoutMS), which exceeds Vercel Hobby's 10s function
// timeout and returns a 500. We poll for up to 14s and fail fast with a
// friendly 503 instead.
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  const deadline = Date.now() + 14000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
    if (mongoose.connection.readyState === 1) return next();
  }
  console.error('[App] MongoDB not connected within 14s');
  res.status(503).json({ status: 'fail', message: 'Database connection timed out, please retry' });
});

// Enhanced API logging
if (process.env.NODE_ENV === 'development') {
  morganBody(app, {
    logResponseBody: true,
    noColors: false,
    theme: 'dimmed',
    dateTimeFormat: 'utc'
  });
}

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/nepalcan', nepalcanRoutes);
app.use('/api/v1/nepalcan-orders', nepalcanOrderRoutes);
app.use('/api/v1/settings/pipeline', pipelineStageRoutes);
app.use('/api/v1/vendor-snapshots', vendorSnapshotRoutes);
app.use('/api/v1/delivery-zones', deliveryZoneRoutes);
app.use('/api/v1/extension', extensionRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/team-targets', teamTargetRoutes);
app.use('/api/v1/finance', financeRoutes);
if (aiRoutes) app.use('/api/v1/ai', aiRoutes);

// Vercel cron endpoint — no auth
app.get('/api/cron/sync', async (req, res) => {
  try {
    const { runFullSync } = require('./services/unifiedSyncService');
    const log = await runFullSync('cron');
    res.status(200).json({ status: 'success', data: log });
  } catch (err) {
    console.error('[Cron] Full sync failed:', err);
    res.status(500).json({ status: 'fail', message: err.message });
  }
});

// Serve Static Frontend in Production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../frontend/dist');

  // Hashed assets (JS/CSS/images) — cache forever, filenames change on rebuild
  app.use(express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    index: false
  }));

  // All other routes — serve index.html with no-cache so browsers always get
  // the latest HTML (and thus the latest chunk filenames) after a deploy
  app.get('*path', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

// Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;
