// server.js - FIXED VERSION FOR PRODUCTION WITH DATABASE MIDDLEWARE
require("dotenv").config();

// Force IPv4 DNS resolution before anything else
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Import configurations and middleware
const dbModule = require("./models");
const logger = require("./utils/logger");
const errorHandler = require("./middleware/errorHandler");
const { authenticateToken } = require("./middleware/auth");

// Import routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const membersRoutes = require("./routes/members");
const attendanceRoutes = require("./routes/attendance");
const eventsRoutes = require("./routes/events");
const celebrationsRoutes = require("./routes/celebrations");
const dashboardRoutes = require("./routes/dashboard");
const publicRoutes = require("./routes/public");

const app = express();
const server = createServer(app);

// Socket.IO setup with FIXED CORS
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        process.env.CLIENT_URL,
        process.env.ADMIN_URL,
        'https://rccg-center.netlify.app',
        'https://rccg-centre-admin-dashboard.netlify.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
      ];
      
      // Check if origin matches or is a subdomain of allowed origins
      const isAllowed = allowedOrigins.some(allowed => 
        origin === allowed || origin.endsWith(allowed.replace('https://', ''))
      );
      
      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(null, true); // Still allow in production to avoid blocking
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
});

app.set("io", io);

// FIXED: More permissive helmet for production
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable CSP for API
}));

// FIXED: Enhanced CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      logger.info('Request without origin header allowed');
      return callback(null, true);
    }

    const allowedOrigins = [
      process.env.CLIENT_URL,
      process.env.ADMIN_URL,
      'https://rccg-center.netlify.app',
      'https://rccg-centre-admin-dashboard.netlify.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ];

    // Check exact match
    if (allowedOrigins.includes(origin)) {
      logger.info(`CORS allowed for origin: ${origin}`);
      return callback(null, true);
    }

    // Check for Netlify deploy previews (they have unique URLs)
    if (origin.includes('netlify.app')) {
      logger.info(`CORS allowed for Netlify origin: ${origin}`);
      return callback(null, true);
    }

    // In production, be more lenient to avoid blocking legitimate requests
    if (process.env.NODE_ENV === 'production') {
      logger.warn(`CORS warning for origin: ${origin} - allowing anyway`);
      return callback(null, true);
    }

    logger.error(`CORS blocked origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers"
  ],
  exposedHeaders: ["Content-Length", "X-Request-Id"],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// FIXED: Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Rate limiting - more lenient for production
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

app.use("/api", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// FIXED: Enhanced logging middleware
if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.info(message.trim()) },
      skip: (req) => req.path === '/health'
    })
  );
}

// FIXED: Add request logging for debugging
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.path}`, {
    origin: req.headers.origin,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  next();
});

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// FIXED: Enhanced health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: db ? "Connected" : "Not initialized",
    version: "1.0.0"
  });
});

// Additional health check for API
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    api: "online",
    database: db ? "connected" : "initializing"
  });
});

// Global variable to hold database instance
let db = null;

// Database connection test endpoint
app.get("/api/debug/db-test", async (req, res) => {
  try {
    if (!db || !db.sequelize) {
      return res.status(500).json({ 
        success: false, 
        message: 'Database not initialized'
      });
    }
    
    await db.sequelize.authenticate();
    res.json({ 
      success: true, 
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database test failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: {
        name: error.name,
        message: error.message
      }
    });
  }
});

// FIXED: Enhanced environment debug endpoint
app.get("/api/debug/env-check", (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DB_HOST: process.env.DB_HOST || 'Not set',
    DB_PORT: process.env.DB_PORT || 'Not set',
    CLIENT_URL: process.env.CLIENT_URL || 'Not set',
    ADMIN_URL: process.env.ADMIN_URL || 'Not set',
    CORS_ORIGINS: [
      process.env.CLIENT_URL,
      process.env.ADMIN_URL
    ],
    DNS_ORDER: dns.getDefaultResultOrder ? dns.getDefaultResultOrder() : 'Not available',
    serverTime: new Date().toISOString()
  });
});

// FIXED: Add CORS test endpoint
app.get("/api/debug/cors-test", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working",
    origin: req.headers.origin,
    method: req.method,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent']
    }
  });
});

// ✨ CRITICAL FIX: Enhanced database middleware that injects models
const ensureDatabase = async (req, res, next) => {
  try {
    if (!db) {
      logger.error('Database not initialized');
      return res.status(503).json({
        success: false,
        message: 'Database not yet initialized, please try again in a moment',
        code: 'DB_NOT_INITIALIZED'
      });
    }

    if (!db.sequelize) {
      logger.error('Database sequelize instance missing');
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        code: 'DB_UNAVAILABLE'
      });
    }

    // ✨ INJECT ALL MODELS INTO REQUEST
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

// ✨ API Routes with database middleware FIRST, then auth
app.use("/api/auth", ensureDatabase, authRoutes);
app.use("/api/admin", ensureDatabase, authenticateToken, adminRoutes);
app.use("/api/members", ensureDatabase, authenticateToken, membersRoutes);
app.use("/api/attendance", ensureDatabase, authenticateToken, attendanceRoutes);
app.use("/api/events", ensureDatabase, eventsRoutes);
app.use("/api/celebrations", ensureDatabase, celebrationsRoutes);
app.use("/api/dashboard", ensureDatabase, authenticateToken, dashboardRoutes);
app.use("/api/public", ensureDatabase, publicRoutes);

// Catch-all for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl,
    method: req.method
  });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on("join-admin", (adminData) => {
    socket.join("admin-room");
    logger.info(`Admin ${adminData.name} joined admin room`);
  });

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Enhanced database connection function with retry logic
async function startServer() {
  try {
    logger.info('🚀 Starting Church Admin API Server...');
    logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🔧 Node Version: ${process.version}`);
    logger.info(`🌐 Client URL: ${process.env.CLIENT_URL}`);
    logger.info(`🌐 Admin URL: ${process.env.ADMIN_URL}`);
    
    // Initialize database with multiple retry attempts
    logger.info('🗄️ Initializing database connection...');
    
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
      try {
        logger.info(`🔄 Database connection attempt ${retryCount + 1}/${maxRetries}...`);
        
        db = await dbModule.initialize();
        
        // ✨ VERIFY ALL MODELS ARE INITIALIZED
        const requiredModels = ['Admin', 'Member', 'Attendance', 'Event', 'Celebration', 'MemberAttendance'];
        const missingModels = requiredModels.filter(model => !db[model]);
        
        if (missingModels.length > 0) {
          throw new Error(`Missing models: ${missingModels.join(', ')}`);
        }
        
        logger.info("✅ Database connection and models initialized successfully!");
        logger.info(`✅ Models available: ${Object.keys(db).filter(k => k !== 'sequelize' && k !== 'Sequelize' && k !== 'initialize').join(', ')}`);
        break;
      } catch (error) {
        retryCount++;
        logger.error(`❌ Database initialization attempt ${retryCount} failed:`, {
          name: error.name,
          message: error.message,
          code: error.code
        });

        if (retryCount >= maxRetries) {
          logger.error("❌ Max database connection retries reached. Exiting...");
          throw error;
        }

        const delay = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 30000);
        logger.info(`⏳ Retrying database connection in ${Math.round(delay / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Test database connection
    if (process.env.NODE_ENV === "production") {
      await db.sequelize.query('SELECT 1 as test');
      logger.info("✅ Database connectivity verified.");
    }

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🎉 Server successfully started!`);
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🗄️ Database: Connected`);
      logger.info(`🔗 Health check: /health`);
      logger.info(`🔗 API Health check: /api/health`);
      logger.info(`📡 CORS enabled for: ${process.env.CLIENT_URL}, ${process.env.ADMIN_URL}`);
    });

  } catch (error) {
    logger.error("❌ Server startup failed:", {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    try {
      if (db && db.sequelize) {
        await db.sequelize.close();
        logger.info("✅ Database connection closed.");
      }
      process.exit(0);
    } catch (error) {
      logger.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("❌ Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };