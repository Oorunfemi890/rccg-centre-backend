// server.js - ADVANCED VERSION WITH IPv6 FIXES
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

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_URL, process.env.ADMIN_URL],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      process.env.ADMIN_URL,
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );
}

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Global variable to hold database instance
let db = null;

// Database connection test endpoint (for debugging)
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

// Environment debug endpoint
app.get("/api/debug/env-check", (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DB_HOST: process.env.DB_HOST || 'Not set',
    DB_PORT: process.env.DB_PORT || 'Not set',
    DNS_ORDER: dns.getDefaultResultOrder ? dns.getDefaultResultOrder() : 'Not available'
  });
});

// Middleware to ensure database is initialized
const ensureDatabase = async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Database not yet initialized, please try again in a moment'
      });
    }
    req.db = db;
    next();
  } catch (error) {
    next(error);
  }
};

// API Routes
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
    logger.info('🚀 Starting Church Admin API Server (Advanced IPv6 Fix)...');
    logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🔧 Node Version: ${process.version}`);
    logger.info(`🌐 DNS Order: ${dns.getDefaultResultOrder ? dns.getDefaultResultOrder() : 'Not available'}`);
    
    // Initialize database with multiple retry attempts
    logger.info('🗄️ Initializing database connection with IPv6 fix...');
    
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
      try {
        logger.info(`🔄 Database connection attempt ${retryCount + 1}/${maxRetries}...`);
        
        // Initialize database models and connections
        db = await dbModule.initialize();
        logger.info("✅ Database connection and models initialized successfully!");
        break;
      } catch (error) {
        retryCount++;
        logger.error(`❌ Database initialization attempt ${retryCount} failed:`, {
          name: error.name,
          message: error.message,
          code: error.code || error.parent?.code || error.original?.code,
          errno: error.errno || error.parent?.errno || error.original?.errno,
          address: error.parent?.address || error.original?.address,
          port: error.parent?.port || error.original?.port,
          syscall: error.parent?.syscall || error.original?.syscall
        });

        if (retryCount >= maxRetries) {
          logger.error("❌ Max database connection retries reached. Exiting...");
          throw error;
        }

        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 30000);
        logger.info(`⏳ Retrying database connection in ${Math.round(delay / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Don't sync in production on Render - it's slow and risky
    if (process.env.NODE_ENV === "development") {
      logger.info('🔄 Synchronizing database models...');
      await db.sequelize.sync({ alter: true });
      logger.info("✅ Database models synchronized.");
    } else {
      // Just test a simple query to ensure connection works
      await db.sequelize.query('SELECT 1 as test');
      logger.info("✅ Database connectivity verified.");
    }

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🎉 Server successfully started!`);
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🗄️ Database: Connected to Supabase with IPv6 fix`);
      logger.info(`🔗 Health check endpoint: /health`);
      
      if (process.env.NODE_ENV === "development") {
        logger.info(`🔍 Debug endpoints available:`);
        logger.info(`   - Database test: /api/debug/db-test`);
        logger.info(`   - Environment check: /api/debug/env-check`);
      }
    });

  } catch (error) {
    logger.error("❌ Server startup failed:", {
      name: error.name,
      message: error.message,
      code: error.code || error.parent?.code || error.original?.code,
      errno: error.errno || error.parent?.errno || error.original?.errno,
      address: error.parent?.address || error.original?.address,
      port: error.parent?.port || error.original?.port,
      syscall: error.parent?.syscall || error.original?.syscall
    });

    // Additional debugging info
    logger.info("🔍 Connection Debug Info:", {
      NODE_ENV: process.env.NODE_ENV,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DNS_ORDER: dns.getDefaultResultOrder ? dns.getDefaultResultOrder() : 'Not available'
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

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error("❌ Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };