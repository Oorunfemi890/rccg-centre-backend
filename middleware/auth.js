// middleware/auth.js
const jwt = require('jsonwebtoken');
const { Admin } = require('../models');
const logger = require('../utils/logger');

// Authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = null;

    // Extract token from Authorization header
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      } else {
        token = authHeader; // Direct token without Bearer prefix
      }
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
        code: 'NO_TOKEN'
      });
    }

    // Verify token format - basic check to see if it looks like a JWT
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      logger.error('Authentication error: Invalid token format', { token: token.substring(0, 20) + '...' });
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      logger.error('JWT verification error:', {
        error: jwtError.message,
        tokenPreview: token.substring(0, 20) + '...'
      });

      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Token verification failed',
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }

    // Check if decoded token has adminId
    if (!decoded.adminId) {
      logger.error('Authentication error: Token missing adminId', { decoded });
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
    }
    
    // Get admin from database
    const admin = await Admin.findByPk(decoded.adminId);
    
    if (!admin) {
      logger.error('Authentication error: Admin not found', { adminId: decoded.adminId });
      return res.status(401).json({
        success: false,
        message: 'Admin account not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    if (!admin.isActive) {
      logger.error('Authentication error: Admin account inactive', { adminId: decoded.adminId });
      return res.status(401).json({
        success: false,
        message: 'Admin account is inactive',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Add admin to request
    req.admin = admin;
    req.adminId = admin.id;
    req.token = token;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
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
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Super admins have all permissions
      if (req.admin.role === 'super_admin') {
        return next();
      }

      // Check if admin has the required permission
      if (!req.admin.permissions || !req.admin.permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permission}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed',
        code: 'PERMISSION_CHECK_ERROR'
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
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED'
      });
    }

    next();
  } catch (error) {
    logger.error('Super admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed',
      code: 'AUTH_CHECK_ERROR'
    });
  }
};

// Optional authentication (for public endpoints that can benefit from auth data)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    }

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
    message: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  }
});

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
  logActivity
};