// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { Admin } = require("../models");
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

const authController = {
  // @desc    Authenticate admin and get token
  // @route   POST /api/auth/login
  // @access  Public
  login: async (req, res) => {
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
      const admin = await Admin.findOne({
        where: { 
          email: email.toLowerCase(),
          isActive: true 
        }
      });

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
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

      // Emit real-time notification if socket available
      if (req.app.get("io")) {
        req.app.get("io").to("admin-room").emit("admin-login", {
          adminName: admin.name,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: admin.toJSON(), // Using 'user' for consistency
          admin: admin.toJSON(), // Also include 'admin' for backward compatibility
          accessToken,
          token: accessToken, // Also include 'token' for backward compatibility
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
  },

  // @desc    Refresh access token
  // @route   POST /api/auth/refresh
  // @access  Public
  refresh: async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      const refreshToken = authHeader && authHeader.split(' ')[1];

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Get admin from database and check if refresh token matches
      const admin = await Admin.findByPk(decoded.adminId);
      
      if (!admin || !admin.isActive || admin.refreshToken !== refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(admin.id);

      // Update admin with new refresh token
      await admin.update({ refreshToken: newRefreshToken });

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          user: admin.toJSON(),
          admin: admin.toJSON(),
          accessToken,
          token: accessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      logger.error("Token refresh error:", error);
      res.status(500).json({
        success: false,
        message: "Token refresh failed",
      });
    }
  },

  // @desc    Verify current token
  // @route   GET /api/auth/verify
  // @access  Private
  verify: async (req, res) => {
    try {
      res.json({
        success: true,
        message: "Token is valid",
        data: {
          user: req.admin.toJSON(),
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
  },

  // @desc    Logout admin and invalidate refresh token
  // @route   POST /api/auth/logout
  // @access  Private
  logout: async (req, res) => {
    try {
      // Clear refresh token
      await req.admin.update({ refreshToken: null });

      // Log logout
      logger.info(`Admin logout: ${req.admin.email} (${req.admin.id})`);

      // Emit real-time notification if socket available
      if (req.app.get("io")) {
        req.app.get("io").to("admin-room").emit("admin-logout", {
          adminName: req.admin.name,
          timestamp: new Date(),
        });
      }

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
  },

  // @desc    Update admin profile
  // @route   PUT /api/auth/profile
  // @access  Private
  updateProfile: async (req, res) => {
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
      if (email && email.toLowerCase() !== req.admin.email.toLowerCase()) {
        const existingAdmin = await Admin.findOne({
          where: { 
            email: email.toLowerCase(),
            id: { [require('sequelize').Op.ne]: req.admin.id }
          }
        });

        if (existingAdmin) {
          return res.status(400).json({
            success: false,
            message: "Email is already in use by another admin",
          });
        }
      }

      // Update admin profile
      await req.admin.update({
        name: name || req.admin.name,
        email: email ? email.toLowerCase() : req.admin.email,
        phone: phone || req.admin.phone,
        position: position || req.admin.position,
      });

      logger.info(`Admin profile updated: ${req.admin.email} (${req.admin.id})`);

      // Emit real-time notification if socket available
      if (req.app.get("io")) {
        req.app.get("io").to("admin-room").emit("admin-profile-updated", {
          adminId: req.admin.id,
          adminName: req.admin.name,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: req.admin.toJSON(),
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
  },

  // @desc    Change admin password
  // @route   PUT /api/auth/change-password
  // @access  Private
  changePassword: async (req, res) => {
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
      const isCurrentPasswordValid = await req.admin.comparePassword(currentPassword);
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
      await req.admin.update({ 
        password: newPassword,
        refreshToken: null // Clear all sessions
      });

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
  },

  // @desc    Get current admin info
  // @route   GET /api/auth/me
  // @access  Private
  getCurrentAdmin: async (req, res) => {
    try {
      res.json({
        success: true,
        message: "Admin information retrieved successfully",
        data: {
          user: req.admin.toJSON(),
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
  },

  // @desc    Request password reset
  // @route   POST /api/auth/forgot-password
  // @access  Public
  forgotPassword: async (req, res) => {
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
      const admin = await Admin.findOne({
        where: { 
          email: email.toLowerCase(),
          isActive: true 
        }
      });

      // Always return success to prevent email enumeration
      if (!admin) {
        return res.json({
          success: true,
          message: "If an account with that email exists, a password reset link has been sent.",
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
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      logger.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Password reset request failed",
      });
    }
  },
};

module.exports = authController;