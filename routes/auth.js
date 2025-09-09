// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const router = express.Router();

const { Admin } = require("../models");
const {
  authenticateToken,
  authRateLimit,
  validateRefreshToken,
  logActivity,
} = require("../middleware/auth");
const logger = require("../utils/logger");

// Helper function to generate tokens
const generateTokens = (adminId) => {
  const accessToken = jwt.sign({ adminId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "15m",
  });

  const refreshToken = jwt.sign({ adminId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
  });

  return { accessToken, refreshToken };
};

// Validation rules
const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),
];

const updateProfileValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("phone")
    .optional()
    .isMobilePhone("any")
    .withMessage("Please provide a valid phone number"),
  body("position")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Position must be less than 100 characters"),
];

// @route   POST /api/auth/login
// @desc    Authenticate admin and get token
// @access  Public
router.post("/login", authRateLimit, loginValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findByEmail(email);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    // Validate password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(admin.id);

    // Update admin with refresh token and last login
    await admin.update({
      refreshToken,
      lastLogin: new Date(),
    });

    // Log successful login
    logger.info(`Admin login successful: ${admin.email} (${admin.id})`);

    // Emit real-time notification
    const io = req.app.get("io");
    io.to("admin-room").emit("admin-login", {
      adminName: admin.name,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        admin: admin.toJSON(),
        token: accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post("/refresh", validateRefreshToken, async (req, res) => {
  try {
    // Generate new tokens
    const { accessToken, refreshToken } = generateTokens(req.admin.id);

    // Update admin with new refresh token
    await req.admin.update({ refreshToken });

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        admin: req.admin.toJSON(),
        token: accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error("Token refresh error:", error);
    res.status(500).json({
      success: false,
      message: "Token refresh failed",
    });
  }
});

// @route   GET /api/auth/verify
// @desc    Verify current token
// @access  Private
router.get("/verify", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Token is valid",
      data: {
        admin: req.admin.toJSON(),
        valid: true,
      },
    });
  } catch (error) {
    logger.error("Token verification error:", error);
    res.status(500).json({
      success: false,
      message: "Token verification failed",
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout admin and invalidate refresh token
// @access  Private
router.post(
  "/logout",
  authenticateToken,
  logActivity("logout"),
  async (req, res) => {
    try {
      // Clear refresh token
      await req.admin.update({ refreshToken: null });

      // Log logout
      logger.info(`Admin logout: ${req.admin.email} (${req.admin.id})`);

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("admin-logout", {
        adminName: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  }
);

// @route   PUT /api/auth/profile
// @desc    Update admin profile
// @access  Private
router.put(
  "/profile",
  authenticateToken,
  updateProfileValidation,
  logActivity("update_profile"),
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { name, email, phone, position } = req.body;

      // Check if email is already taken by another admin
      if (email !== req.admin.email) {
        const existingAdmin = await Admin.findByEmail(email);
        if (existingAdmin && existingAdmin.id !== req.admin.id) {
          return res.status(400).json({
            success: false,
            message: "Email is already in use by another admin",
          });
        }
      }

      // Update admin profile
      await req.admin.update({
        name,
        email,
        phone,
        position,
      });

      logger.info(
        `Admin profile updated: ${req.admin.email} (${req.admin.id})`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("admin-profile-updated", {
        adminId: req.admin.id,
        adminName: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          admin: req.admin.toJSON(),
        },
      });
    } catch (error) {
      logger.error("Profile update error:", error);
      res.status(500).json({
        success: false,
        message: "Profile update failed",
      });
    }
  }
);

// @route   PUT /api/auth/change-password
// @desc    Change admin password
// @access  Private
router.put(
  "/change-password",
  authenticateToken,
  changePasswordValidation,
  logActivity("change_password"),
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Verify current password
      const isCurrentPasswordValid = await req.admin.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Check if new password is different from current
      const isSamePassword = await req.admin.comparePassword(newPassword);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: "New password must be different from current password",
        });
      }

      // Update password
      await req.admin.update({ password: newPassword });

      // Clear all refresh tokens to force re-login on all devices
      await req.admin.update({ refreshToken: null });

      logger.info(`Password changed: ${req.admin.email} (${req.admin.id})`);

      res.json({
        success: true,
        message: "Password changed successfully. Please log in again.",
      });
    } catch (error) {
      logger.error("Password change error:", error);
      res.status(500).json({
        success: false,
        message: "Password change failed",
      });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current admin info
// @access  Private
router.get("/me", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        admin: req.admin.toJSON(),
      },
    });
  } catch (error) {
    logger.error("Get current admin error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get admin information",
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post(
  "/forgot-password",
  authRateLimit,
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { email } = req.body;

      // Find admin by email
      const admin = await Admin.findByEmail(email);

      // Always return success to prevent email enumeration
      if (!admin) {
        return res.json({
          success: true,
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      }

      // Generate password reset token
      const resetToken = jwt.sign(
        { adminId: admin.id },
        process.env.JWT_SECRET + admin.password, // Include password hash to invalidate token on password change
        { expiresIn: "1h" }
      );

      // Save reset token and expiry
      await admin.update({
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });

      // TODO: Send email with reset link
      // await emailService.sendPasswordResetEmail(admin.email, resetToken);

      logger.info(`Password reset requested: ${admin.email} (${admin.id})`);

      res.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      logger.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Password reset request failed",
      });
    }
  }
);

module.exports = router;
