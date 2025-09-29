// routes/admin.js
const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { requireSuperAdmin, logActivity } = require('../middleware/auth');

// @route   GET /api/admin
// @desc    Get all admins
router.get('/', requireSuperAdmin, adminController.getAllAdmins);

// @route   POST /api/admin
// @desc    Create new admin
router.post(
  '/',
  requireSuperAdmin,
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['super_admin', 'admin']).withMessage('Invalid role'),
    body('permissions').optional().isArray().withMessage('Permissions must be an array')
  ],
  logActivity('create_admin'),
  adminController.createAdmin
);

// @route   GET /api/admin/:id
// @desc    Get single admin by ID
router.get(
  '/:id',
  requireSuperAdmin,
  [param('id').isUUID().withMessage('Invalid admin ID')],
  adminController.getAdminById
);

// @route   PUT /api/admin/:id
// @desc    Update admin
router.put(
  '/:id',
  requireSuperAdmin,
  [
    param('id').isUUID().withMessage('Invalid admin ID'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
    body('role').isIn(['super_admin', 'admin']).withMessage('Invalid role'),
    body('permissions').optional().isArray().withMessage('Permissions must be an array')
  ],
  logActivity('update_admin'),
  adminController.updateAdmin
);

// @route   DELETE /api/admin/:id
// @desc    Delete admin
router.delete(
  '/:id',
  requireSuperAdmin,
  [param('id').isUUID().withMessage('Invalid admin ID')],
  logActivity('delete_admin'),
  adminController.deleteAdmin
);

// @route   PUT /api/admin/:id/password
// @desc    Update admin password
router.put(
  '/:id/password',
  requireSuperAdmin,
  [
    param('id').isUUID().withMessage('Invalid admin ID'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  logActivity('update_admin_password'),
  adminController.updateAdminPassword
);

// @route   GET /api/admin/:id/activity
// @desc    Get admin activity logs
router.get(
  '/:id/activity',
  requireSuperAdmin,
  [param('id').isUUID().withMessage('Invalid admin ID')],
  adminController.getAdminActivity
);

// @route   PUT /api/admin/:id/permissions
// @desc    Update admin permissions
router.put(
  '/:id/permissions',
  requireSuperAdmin,
  [
    param('id').isUUID().withMessage('Invalid admin ID'),
    body('permissions').isArray().withMessage('Permissions must be an array'),
    body('permissions.*').isString().withMessage('Each permission must be a string')
  ],
  logActivity('update_admin_permissions'),
  adminController.updateAdminPermissions
);

// @route   GET /api/admin/stats
// @desc    Get admin statistics
router.get('/stats', requireSuperAdmin, adminController.getAdminStats);

module.exports = router;
