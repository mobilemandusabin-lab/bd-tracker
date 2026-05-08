const express = require('express');
const morgan = require('morgan');
const morganBody = require('morgan-body');
const helmet = require('helmet');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const leadRoutes = require('./routes/leadRoutes');
const activityRoutes = require('./routes/activityRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const path = require('path');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const goalRoutes = require('./routes/goalRoutes');
const taskRoutes = require('./routes/taskRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const nepalcanRoutes = require('./routes/nepalcanRoutes');
const nepalcanOrderRoutes = require('./routes/nepalcanOrderRoutes');

const app = express();

// CORS configuration for specific origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
  'https://bd-tracker-delta.vercel.app',
  'https://bd-tracker-delta.vercel.app/api/v1',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(morgan('dev'));
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

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
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/nepalcan', nepalcanRoutes);
app.use('/api/v1/nepalcan-orders', nepalcanOrderRoutes);

// Serve Static Frontend in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  
  app.get('*path', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend', 'dist', 'index.html'));
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
