// middleware/database.js - Database injection middleware
const db = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware to inject database models into request object
 * This ensures all models are available in controllers via req.db
 */
const ensureDatabase = async (req, res, next) => {
  try {
    // Wait for database initialization if not ready
    if (!db.sequelize) {
      logger.warn('Database not initialized, waiting...');
      await db.initialize();
    }

    // Check if database connection is active
    if (!db.sequelize) {
      logger.error('Database initialization failed');
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        code: 'DB_UNAVAILABLE'
      });
    }

    // Inject all models into request object
    req.db = {
      sequelize: db.sequelize,
      Sequelize: db.Sequelize,
      Admin: db.Admin,
      Member: db.Member,
      Attendance: db.Attendance,
      Event: db.Event,
      Celebration: db.Celebration,
      MemberAttendance: db.MemberAttendance
    };

    next();
  } catch (error) {
    logger.error('Database middleware error:', error);
    
    return res.status(503).json({
      success: false,
      message: 'Database connection error',
      code: 'DB_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware to check database health
 * Use this for health check endpoints
 */
const checkDatabaseHealth = async (req, res, next) => {
  try {
    if (!db.sequelize) {
      return res.status(503).json({
        success: false,
        message: 'Database not initialized',
        healthy: false
      });
    }

    // Test database connection
    await db.sequelize.authenticate();
    
    req.dbHealth = {
      healthy: true,
      connected: true,
      timestamp: new Date()
    };
    
    next();
  } catch (error) {
    logger.error('Database health check failed:', error);
    
    req.dbHealth = {
      healthy: false,
      connected: false,
      error: error.message,
      timestamp: new Date()
    };
    
    next();
  }
};

module.exports = {
  ensureDatabase,
  checkDatabaseHealth
};

// Example usage in your server file:
/*
// server.js or app.js

const express = require('express');
const { ensureDatabase } = require('./middleware/database');
const db = require('./models');

const app = express();

// ... other middleware (cors, body-parser, etc.)

// Initialize database before setting up routes
(async () => {
  try {
    // Initialize database
    await db.initialize();
    console.log('✅ Database initialized successfully');

    // Apply database middleware to all routes
    app.use(ensureDatabase);

    // Now set up your routes
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/members', require('./routes/members'));
    app.use('/api/events', require('./routes/events'));
    app.use('/api/attendance', require('./routes/attendance'));
    // ... other routes

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
})();
*/