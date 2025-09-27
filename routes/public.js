// routes/public.js - Public Routes for Church Main Site
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const publicController = require('../controllers/publicController');
const { uploadMiddleware } = require('../middleware/upload');
const logger = require('../utils/logger');

// Rate limiting for public endpoints
const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 submissions per window per IP
  message: {
    success: false,
    message: 'Too many submission attempts. Please wait a moment and try again.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  }
});

// Celebration form rate limiting (stricter)
const celebrationFormRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 celebration submissions per hour per IP
  message: {
    success: false,
    message: 'You have submitted too many celebration requests. Please wait an hour before submitting again.',
    code: 'CELEBRATION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation for celebration submission
const celebrationSubmissionValidation = [
  body('type')
    .notEmpty()
    .withMessage('Celebration type is required')
    .isIn([
      'Birthday',
      'Wedding Anniversary',
      'Baby Dedication',
      'Graduation',
      'Promotion',
      'New Job',
      'New Baby',
      'House Dedication',
      'Other'
    ])
    .withMessage('Invalid celebration type'),
  
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Name must be between 2 and 200 characters')
    .matches(/^[a-zA-Z\s'-\.]+$/)
    .withMessage('Name contains invalid characters'),
  
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters')
    .matches(/^[\+\d\s\-\(\)]+$/)
    .withMessage('Phone number format is invalid'),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('message')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Message must be less than 1000 characters'),
  
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Please select a valid month (1-12)'),
  
  body('date')
    .isInt({ min: 1, max: 31 })
    .withMessage('Please select a valid date (1-31)')
    .custom((date, { req }) => {
      const month = parseInt(req.body.month);
      const year = req.body.year ? parseInt(req.body.year) : new Date().getFullYear();
      
      if (month && date) {
        const daysInMonth = new Date(year, month, 0).getDate();
        if (date > daysInMonth) {
          throw new Error(`The selected date (${date}) is invalid for the selected month`);
        }
      }
      return true;
    }),
  
  body('year')
    .optional()
    .isInt({ min: 1900, max: 2100 })
    .withMessage('Year must be between 1900 and 2100')
];

// Validation for contact form
const contactInquiryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters')
];

// Validation for celebration status check
const celebrationStatusValidation = [
  param('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ min: 10, max: 20 })
    .withMessage('Invalid phone number format')
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Public form validation failed', {
      ip: req.ip,
      errors: errors.array(),
      body: { ...req.body, pictures: req.files ? `${req.files.length} files` : 'none' }
    });

    return res.status(400).json({
      success: false,
      message: 'Please correct the following errors and try again',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// File validation middleware
const validateFiles = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one picture is required for your celebration request'
    });
  }

  if (req.files.length > 5) {
    return res.status(400).json({
      success: false,
      message: 'You can upload a maximum of 5 pictures'
    });
  }

  // Additional file validation
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  for (const file of req.files) {
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `File "${file.originalname}" is not a valid image type. Please use JPG, PNG, GIF, or WebP.`
      });
    }

    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File "${file.originalname}" is too large. Maximum size is 5MB per file.`
      });
    }
  }

  next();
};

// Security headers middleware
const setSecurityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

// Log public requests
const logPublicRequest = (req, res, next) => {
  logger.info('Public API request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
};

// PUBLIC ROUTES

// @route   GET /api/public/health
// @desc    Health check for public endpoints
// @access  Public
router.get('/health', setSecurityHeaders, publicController.healthCheck);

// @route   GET /api/public/celebration-types
// @desc    Get available celebration types for form dropdown
// @access  Public
router.get(
  '/celebration-types',
  setSecurityHeaders,
  publicRateLimit,
  publicController.getCelebrationTypes
);

// @route   POST /api/public/celebrations
// @desc    Submit celebration request from church main site
// @access  Public
router.post(
  '/celebrations',
  setSecurityHeaders,
  logPublicRequest,
  celebrationFormRateLimit,
  uploadMiddleware.multiple('pictures', 5),
  validateFiles,
  celebrationSubmissionValidation,
  handleValidationErrors,
  publicController.submitCelebration
);

// @route   GET /api/public/celebration-status/:phone
// @desc    Check celebration status by phone number (for follow-up)
// @access  Public (with rate limiting)
router.get(
  '/celebration-status/:phone',
  setSecurityHeaders,
  publicRateLimit,
  celebrationStatusValidation,
  handleValidationErrors,
  publicController.getCelebrationStatus
);

// @route   POST /api/public/contact-celebration
// @desc    Contact form for celebration inquiries
// @access  Public
router.post(
  '/contact-celebration',
  setSecurityHeaders,
  publicRateLimit,
  contactInquiryValidation,
  handleValidationErrors,
  publicController.submitContactInquiry
);

// Error handling for public routes
router.use(publicController.handleError);

module.exports = router;