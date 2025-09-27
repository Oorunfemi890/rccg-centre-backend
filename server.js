// server.js
require("dotenv").config();
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
const db = require("./models");
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

// Make io available in request object
app.set("io", io);

// Security middleware
app.use(
  helmet({
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
  })
);

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
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: Math.ceil(
      (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000
    ),
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

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", authenticateToken, adminRoutes);
app.use("/api/members", authenticateToken, membersRoutes);
app.use("/api/attendance", authenticateToken, attendanceRoutes);
app.use("/api/events", eventsRoutes); // Some endpoints public, some protected
app.use("/api/celebrations", celebrationsRoutes); // Some endpoints public, some protected
app.use("/api/dashboard", authenticateToken, dashboardRoutes);
app.use("/api/public", publicRoutes);

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

  // Join admin room for real-time updates
  socket.on("join-admin", (adminData) => {
    socket.join("admin-room");
    logger.info(`Admin ${adminData.name} joined admin room`);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Database connection and server startup
async function startServer() {
  try {
    // Test database connection
    await db.sequelize.authenticate();
    logger.info("✅ Database connection established successfully.");

    // Sync database models
    if (process.env.NODE_ENV === "development") {
      await db.sequelize.sync({ alter: true });
      logger.info("✅ Database models synchronized.");
    }

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 CORS enabled for: ${process.env.CLIENT_URL}`);

      if (process.env.NODE_ENV === "development") {
        logger.info(
          `📋 API Documentation available at: http://localhost:${PORT}/api`
        );
      }
    });
  } catch (error) {
    logger.error("❌ Unable to start server", { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully...");

  server.close(async () => {
    try {
      await db.sequelize.close();
      logger.info("✅ Database connection closed.");
      process.exit(0);
    } catch (error) {
      logger.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  });
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully...");

  server.close(async () => {
    try {
      await db.sequelize.close();
      logger.info("✅ Database connection closed.");
      process.exit(0);
    } catch (error) {
      logger.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  });
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
