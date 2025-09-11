// controllers/authController.js - Enhanced with better logging and validation
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { validationResult } = require("express-validator");
const { Admin } = require("../models");
const logger = require("../utils/logger");
const emailService = require("../services/emailService");

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

// Helper function to generate secure token
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
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

  // @desc    Request profile update token
  // @route   POST /api/auth/request-profile-update
  // @access  Private
  requestProfileUpdate: async (req, res) => {
    try {
      const { type } = req.body; // 'email' or 'profile'

      // Generate secure token
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store token in database
      await req.admin.update({
        profileUpdateToken: token,
        profileUpdateTokenExpires: expiresAt,
        profileUpdateType: type
      });

      // Send email with token
      await emailService.sendProfileUpdateEmail(req.admin, token, type);

      logger.info(`Profile update token requested: ${req.admin.email} (${type})`);

      res.json({
        success: true,
        message: "Verification token sent to your email. Please check your inbox.",
      });
    } catch (error) {
      logger.error("Request profile update error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send verification token",
      });
    }
  },

  // @desc    Update admin profile with token verification
  // @route   PUT /api/auth/profile
  // @access  Private
  updateProfile: async (req, res) => {
    try {
      // ENHANCED: Add comprehensive request logging
      logger.info('Profile update request received:', {
        adminId: req.admin.id,
        adminEmail: req.admin.email,
        requestBody: {
          name: req.body.name,
          email: req.body.email,
          phone: req.body.phone,
          position: req.body.position,
          hasToken: !!req.body.token,
          tokenLength: req.body.token?.length
        },
        headers: {
          contentType: req.headers['content-type'],
          authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'none'
        }
      });

      // Check validation errors FIRST
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.error('Profile update validation errors:', {
          errors: errors.array(),
          requestBody: req.body
        });
        
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { name, email, phone, position, token } = req.body;

      // FIXED: Reload admin data to get the latest token information
      await req.admin.reload();

      logger.info('Profile update debug info (after reload):', {
        adminId: req.admin.id,
        currentEmail: req.admin.email,
        requestedEmail: email,
        hasToken: !!token,
        storedToken: req.admin.profileUpdateToken ? 'exists' : 'none',
        tokenType: req.admin.profileUpdateType,
        tokenExpiry: req.admin.profileUpdateTokenExpires,
        isExpired: req.admin.profileUpdateTokenExpires ? req.admin.profileUpdateTokenExpires < new Date() : 'no expiry'
      });

      // If email is being changed, require token verification
      if (email && email.toLowerCase() !== req.admin.email.toLowerCase()) {
        logger.info('Email change detected, validating token...');
        
        if (!token) {
          logger.error('No token provided for email change');
          return res.status(400).json({
            success: false,
            message: "Email verification token is required to change email address",
          });
        }

        // FIXED: Better token validation logic
        if (!req.admin.profileUpdateToken) {
          logger.error('No stored token found for admin');
          return res.status(400).json({
            success: false,
            message: "No verification token found. Please request a new token.",
          });
        }

        if (req.admin.profileUpdateToken !== token) {
          logger.error('Token mismatch:', {
            provided: token.substring(0, 10) + '...',
            stored: req.admin.profileUpdateToken.substring(0, 10) + '...'
          });
          return res.status(400).json({
            success: false,
            message: "Invalid verification token",
          });
        }

        if (!req.admin.profileUpdateTokenExpires || req.admin.profileUpdateTokenExpires < new Date()) {
          logger.error('Token expired:', {
            expiry: req.admin.profileUpdateTokenExpires,
            now: new Date()
          });
          return res.status(400).json({
            success: false,
            message: "Verification token has expired. Please request a new token.",
          });
        }

        // FIXED: Check token type
        if (req.admin.profileUpdateType !== 'email') {
          logger.error('Wrong token type:', {
            expected: 'email',
            actual: req.admin.profileUpdateType
          });
          return res.status(400).json({
            success: false,
            message: "Token is not valid for email updates",
          });
        }

        // Check if email is already taken by another admin
        const existingAdmin = await Admin.findOne({
          where: { 
            email: email.toLowerCase(),
            id: { [require('sequelize').Op.ne]: req.admin.id }
          }
        });

        if (existingAdmin) {
          logger.error('Email already exists:', {
            requestedEmail: email.toLowerCase(),
            existingAdminId: existingAdmin.id
          });
          return res.status(400).json({
            success: false,
            message: "Email is already in use by another admin",
          });
        }
      }

      // FIXED: Build update data properly
      const updateData = {};

      // Always update these fields if provided
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;  
      if (position !== undefined) updateData.position = position;

      // Only update email if token was verified
      if (email && token && req.admin.profileUpdateToken === token) {
        updateData.email = email.toLowerCase();
        // Clear the verification tokens after successful use
        updateData.profileUpdateToken = null;
        updateData.profileUpdateTokenExpires = null;
        updateData.profileUpdateType = null;
      }

      logger.info('Updating admin with data:', updateData);

      // FIXED: Update the admin record
      const updatedAdmin = await req.admin.update(updateData);

      // FIXED: Reload to get the updated data
      await updatedAdmin.reload();

      logger.info(`Admin profile updated successfully: ${updatedAdmin.email} (${updatedAdmin.id})`);

      // Emit real-time notification if socket available
      if (req.app.get("io")) {
        req.app.get("io").to("admin-room").emit("admin-profile-updated", {
          adminId: updatedAdmin.id,
          adminName: updatedAdmin.name,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: updatedAdmin.toJSON(),
          admin: updatedAdmin.toJSON(),
        },
      });
    } catch (error) {
      logger.error("Profile update error:", error);
      res.status(500).json({
        success: false,
        message: "Profile update failed",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // @desc    Request password change token
  // @route   POST /api/auth/request-password-change
  // @access  Private
  requestPasswordChange: async (req, res) => {
    try {
      const { currentPassword } = req.body;

      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required",
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await req.admin.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Generate secure token
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store token in database
      await req.admin.update({
        passwordChangeToken: token,
        passwordChangeTokenExpires: expiresAt
      });

      // Send email with token
      await emailService.sendPasswordChangeEmail(req.admin, token);

      logger.info(`Password change token requested: ${req.admin.email}`);

      res.json({
        success: true,
        message: "Password change verification token sent to your email.",
      });
    } catch (error) {
      logger.error("Request password change error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send verification token",
      });
    }
  },

  // @desc    Change admin password with token verification
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

      const { token, newPassword } = req.body;

      // FIXED: Reload admin data
      await req.admin.reload();

      // Verify token
      if (!token || req.admin.passwordChangeToken !== token || 
          !req.admin.passwordChangeTokenExpires || 
          req.admin.passwordChangeTokenExpires < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification token",
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

      // Update password and clear tokens
      await req.admin.update({ 
        password: newPassword,
        refreshToken: null, // Clear all sessions
        passwordChangeToken: null,
        passwordChangeTokenExpires: null
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

      // Send email with reset link
      await emailService.sendPasswordResetEmail(admin, resetToken);

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

  // @desc    Verify profile update token
  // @route   POST /api/auth/verify-profile-token
  // @access  Private
  verifyProfileToken: async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required",
        });
      }

      // FIXED: Reload admin data
      await req.admin.reload();

      // Check if token is valid and not expired
      const isValid = req.admin.profileUpdateToken === token && 
                     req.admin.profileUpdateTokenExpires && 
                     req.admin.profileUpdateTokenExpires > new Date();

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification token",
        });
      }

      res.json({
        success: true,
        message: "Token verified successfully",
        data: {
          type: req.admin.profileUpdateType
        }
      });
    } catch (error) {
      logger.error("Verify profile token error:", error);
      res.status(500).json({
        success: false,
        message: "Token verification failed",
      });
    }
  },

  // @desc    Verify password change token
  // @route   POST /api/auth/verify-password-token
  // @access  Private
  verifyPasswordToken: async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required",
        });
      }

      // FIXED: Reload admin data
      await req.admin.reload();

      // Check if token is valid and not expired
      const isValid = req.admin.passwordChangeToken === token && 
                     req.admin.passwordChangeTokenExpires && 
                     req.admin.passwordChangeTokenExpires > new Date();

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification token",
        });
      }

      res.json({
        success: true,
        message: "Token verified successfully"
      });
    } catch (error) {
      logger.error("Verify password token error:", error);
      res.status(500).json({
        success: false,
        message: "Token verification failed",
      });
    }
  },
};

module.exports = authController;