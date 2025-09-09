// middleware/auth.js
const jwt = require('jsonwebtoken');
const { Admin } = require('../models');
const logger = require('../utils/logger');

// Authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get admin from database
    const admin = await Admin.findByPk(decoded.adminId);
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or admin account is inactive'
      });
    }

    // Add admin to request
    req.admin = admin;
    req.adminId = admin.id;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Check if admin has specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Super admins have all permissions
      if (req.admin.role === 'super_admin') {
        return next();
      }

      // Check if admin has the required permission
      if (!req.admin.hasPermission(permission)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permission}`
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

// Check if admin has super admin role
const requireSuperAdmin = (req, res, next) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required'
      });
    }

    next();
  } catch (error) {
    logger.error('Super admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

// Optional authentication (for public endpoints that can benefit from auth data)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.admin = null;
      req.adminId = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get admin from database
    const admin = await Admin.findByPk(decoded.adminId);
    
    if (admin && admin.isActive) {
      req.admin = admin;
      req.adminId = admin.id;
    } else {
      req.admin = null;
      req.adminId = null;
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    req.admin = null;
    req.adminId = null;
    next();
  }
};

// Rate limiting for authentication endpoints
const authRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  }
});

// Validate refresh token
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Get admin from database and check if refresh token matches
    const admin = await Admin.findByPk(decoded.adminId);
    
    if (!admin || !admin.isActive || admin.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    req.admin = admin;
    req.adminId = admin.id;
    req.refreshToken = refreshToken;
    
    next();
  } catch (error) {
    logger.error('Refresh token validation error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Refresh token validation failed'
    });
  }
};

// Log admin activity
const logActivity = (action) => {
  return (req, res, next) => {
    // Store activity info for later logging
    req.activityLog = {
      action,
      adminId: req.adminId,
      adminName: req.admin?.name,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    next();
  };
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireSuperAdmin,
  optionalAuth,
  authRateLimit,
  validateRefreshToken,
  logActivity
};