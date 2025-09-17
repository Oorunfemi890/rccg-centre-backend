// routes/public.js - Public Routes for Church Main Site
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const celebrationController = require('../controllers/celebrationsController');
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

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Celebration form validation failed', {
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

// PUBLIC ENDPOINTS

// @route   GET /api/public/health
// @desc    Health check for public endpoints
// @access  Public
router.get('/health', setSecurityHeaders, (req, res) => {
  res.json({
    success: true,
    message: 'Public API is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      celebrations: '/api/public/celebrations',
      celebrationTypes: '/api/public/celebration-types'
    }
  });
});

// @route   GET /api/public/celebration-types
// @desc    Get available celebration types for form dropdown
// @access  Public
router.get('/celebration-types', setSecurityHeaders, publicRateLimit, (req, res) => {
  try {
    const celebrationTypes = [
      { value: 'Birthday', label: 'Birthday 🎂', emoji: '🎂' },
      { value: 'Wedding Anniversary', label: 'Wedding Anniversary 💍', emoji: '💍' },
      { value: 'Baby Dedication', label: 'Baby Dedication 👶', emoji: '👶' },
      { value: 'Graduation', label: 'Graduation 🎓', emoji: '🎓' },
      { value: 'Promotion', label: 'Career Promotion 💼', emoji: '💼' },
      { value: 'New Job', label: 'New Job 🎯', emoji: '🎯' },
      { value: 'New Baby', label: 'New Baby 🍼', emoji: '🍼' },
      { value: 'House Dedication', label: 'House Dedication 🏠', emoji: '🏠' },
      { value: 'Other', label: 'Other Celebration 🎉', emoji: '🎉' }
    ];

    res.json({
      success: true,
      data: celebrationTypes,
      message: 'Celebration types retrieved successfully'
    });
  } catch (error) {
    logger.error('Get celebration types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve celebration types'
    });
  }
});

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
  async (req, res) => {
    try {
      // Add additional logging for public submissions
      logger.info('Public celebration submission received', {
        type: req.body.type,
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        filesCount: req.files ? req.files.length : 0
      });

      // Call the controller method
      await celebrationController.submitCelebration(req, res);
    } catch (error) {
      logger.error('Public celebration submission error:', error);
      res.status(500).json({
        success: false,
        message: 'We encountered an error processing your celebration request. Please try again or contact us directly.'
      });
    }
  }
);

// @route   GET /api/public/celebration-status/:phone
// @desc    Check celebration status by phone number (for follow-up)
// @access  Public (with rate limiting)
router.get(
  '/celebration-status/:phone',
  setSecurityHeaders,
  publicRateLimit,
  [
    param('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isLength({ min: 10, max: 20 })
      .withMessage('Invalid phone number format')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { phone } = req.params;
      
      const celebrations = await Celebration.findAll({
        where: {
          phone: phone,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        attributes: ['id', 'type', 'name', 'status', 'createdAt', 'acknowledgedDate'],
        order: [['createdAt', 'DESC']],
        limit: 5
      });

      if (celebrations.length === 0) {
        return res.json({
          success: true,
          message: 'No recent celebration requests found for this phone number',
          data: []
        });
      }

      const statusData = celebrations.map(celebration => ({
        id: celebration.id,
        type: celebration.type,
        name: celebration.name,
        status: celebration.status,
        submittedAt: celebration.createdAt,
        acknowledgedAt: celebration.acknowledgedDate,
        statusMessage: getStatusMessage(celebration.status)
      }));

      res.json({
        success: true,
        message: 'Celebration status retrieved successfully',
        data: statusData
      });

    } catch (error) {
      logger.error('Get celebration status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check celebration status'
      });
    }
  }
);

// Helper function to get status message
const getStatusMessage = (status) => {
  switch (status) {
    case 'pending':
      return 'Your celebration request is being reviewed. We will contact you soon!';
    case 'approved':
      return 'Great news! Your celebration has been approved. We will acknowledge it during service.';
    case 'rejected':
      return 'We were unable to approve this celebration request. Please contact us for more information.';
    default:
      return 'Status unknown. Please contact us for more information.';
  }
};

// @route   POST /api/public/contact-celebration
// @desc    Contact form for celebration inquiries
// @access  Public
router.post(
  '/contact-celebration',
  setSecurityHeaders,
  publicRateLimit,
  [
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
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;

      logger.info('Celebration contact form submission', {
        name,
        email,
        phone,
        subject,
        ip: req.ip
      });

      // Here you would typically send an email to admins
      // await emailService.sendCelebrationInquiry({ name, email, phone, subject, message });

      res.json({
        success: true,
        message: 'Thank you for your inquiry! We will get back to you within 24 hours.'
      });

    } catch (error) {
      logger.error('Contact celebration form error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send your inquiry. Please try again or contact us directly.'
      });
    }
  }
);

// Error handling for public routes
router.use((error, req, res, next) => {
  logger.error('Public route error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Don't expose internal errors to public
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again or contact support.',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;