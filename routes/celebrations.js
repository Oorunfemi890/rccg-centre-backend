// routes/celebrations.js - Updated with Controller
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();

const celebrationController = require('../controllers/celebrationsController');
const {
  authenticateToken,
  requirePermission,
  optionalAuth,
  logActivity
} = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/upload');

// Validation rules
const createCelebrationValidation = [
  body('type')
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
    .isLength({ min: 2, max: 200 })
    .withMessage('Name must be between 2 and 200 characters'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('message')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Message must be less than 1000 characters'),
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('date')
    .isInt({ min: 1, max: 31 })
    .withMessage('Date must be between 1 and 31'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: 2100 })
    .withMessage('Year must be between 1900 and 2100')
];

const updateCelebrationStatusValidation = [
  param('id').isUUID().withMessage('Invalid celebration ID'),
  body('status')
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Invalid status'),
  body('rejectionReason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Rejection reason must be less than 500 characters')
];

const celebrationIdValidation = [
  param('id').isUUID().withMessage('Invalid celebration ID')
];

const bulkActionValidation = [
  body('celebrationIds')
    .isArray({ min: 1 })
    .withMessage('Please provide at least one celebration ID'),
  body('celebrationIds.*')
    .isUUID()
    .withMessage('Each celebration ID must be valid')
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// ADMIN ROUTES (Protected)
// @route   GET /api/celebrations
// @desc    Get all celebrations with filtering (admin only)
// @access  Private (requires celebrations permission)
router.get(
  '/',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationController.getCelebrations
);

// @route   GET /api/celebrations/stats
// @desc    Get celebration statistics
// @access  Private (requires celebrations permission)
router.get(
  '/stats',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationController.getCelebrationsStats
);

// @route   GET /api/celebrations/upcoming
// @desc    Get upcoming celebrations
// @access  Private (requires celebrations permission)
router.get(
  '/upcoming',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationController.getUpcomingCelebrations
);

// @route   GET /api/celebrations/today
// @desc    Get today's celebrations
// @access  Private (requires celebrations permission)
router.get(
  '/today',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationController.getTodaysCelebrations
);

// @route   GET /api/celebrations/trends
// @desc    Get celebration trends for analytics
// @access  Private (requires celebrations permission)
router.get(
  '/trends',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationController.getCelebrationTrends
);

// @route   GET /api/celebrations/pending/count
// @desc    Get pending celebrations count
// @access  Private (requires celebrations permission)
router.get(
  '/pending/count',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationController.getPendingCount
);

// @route   GET /api/celebrations/month
// @desc    Get celebrations by month
// @access  Private (requires celebrations permission)
router.get(
  '/month',
  authenticateToken,
  requirePermission('celebrations'),
  [
    query('month')
      .isInt({ min: 1, max: 12 })
      .withMessage('Month must be between 1 and 12'),
    query('year')
      .optional()
      .isInt({ min: 1900, max: 2100 })
      .withMessage('Year must be between 1900 and 2100')
  ],
  handleValidationErrors,
  celebrationController.getCelebrationsByMonth
);

// @route   GET /api/celebrations/export
// @desc    Export celebrations to CSV
// @access  Private (requires celebrations permission)
router.get(
  '/export',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationController.exportCelebrations
);

// @route   GET /api/celebrations/:id
// @desc    Get celebration by ID
// @access  Private (requires celebrations permission)
router.get(
  '/:id',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationIdValidation,
  handleValidationErrors,
  celebrationController.getCelebrationById
);

// @route   POST /api/celebrations/bulk-approve
// @desc    Bulk approve celebrations
// @access  Private (requires celebrations permission)
router.post(
  '/bulk-approve',
  authenticateToken,
  requirePermission('celebrations'),
  bulkActionValidation,
  handleValidationErrors,
  logActivity('bulk_approve_celebrations'),
  celebrationController.bulkApproveCelebrations
);

// @route   PATCH /api/celebrations/:id/status
// @desc    Update celebration status (approve/reject)
// @access  Private (requires celebrations permission)
router.patch(
  '/:id/status',
  authenticateToken,
  requirePermission('celebrations'),
  updateCelebrationStatusValidation,
  handleValidationErrors,
  logActivity('update_celebration_status'),
  celebrationController.updateCelebrationStatus
);

// @route   DELETE /api/celebrations/:id
// @desc    Delete celebration
// @access  Private (requires celebrations permission)
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('celebrations'),
  celebrationIdValidation,
  handleValidationErrors,
  logActivity('delete_celebration'),
  celebrationController.deleteCelebration
);

module.exports = router;