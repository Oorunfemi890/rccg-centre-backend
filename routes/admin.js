// routes/admin.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();

const { Admin } = require('../models');
const { requireSuperAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

// @route   GET /api/admin
// @desc    Get all admins (super admin only)
// @access  Private (super admin only)
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: { exclude: ['password', 'refreshToken', 'passwordResetToken'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      message: 'Admins retrieved successfully',
      data: admins
    });

  } catch (error) {
    logger.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve admins'
    });
  }
});

// @route   POST /api/admin
// @desc    Create new admin (super admin only)
// @access  Private (super admin only)
router.post('/', requireSuperAdmin, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['super_admin', 'admin']).withMessage('Invalid role'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array')
], logActivity('create_admin'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password, role, phone, position, permissions = [] } = req.body;

    // Check if admin with email already exists
    const existingAdmin = await Admin.findByEmail(email);
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Create new admin
    const newAdmin = await Admin.create({
      name,
      email,
      password,
      role,
      phone,
      position,
      permissions: role === 'super_admin' ? ['all'] : permissions,
      isActive: true
    });

    logger.info(`New admin created: ${newAdmin.name} (${newAdmin.email}) by ${req.admin.name}`);

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: newAdmin.toJSON()
    });

  } catch (error) {
    logger.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin'
    });
  }
});

// @route   PUT /api/admin/:id
// @desc    Update admin (super admin only)
// @access  Private (super admin only)
router.put('/:id', requireSuperAdmin, [
  param('id').isUUID().withMessage('Invalid admin ID'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('role').isIn(['super_admin', 'admin']).withMessage('Invalid role'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array')
], logActivity('update_admin'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const admin = await Admin.findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const { name, email, role, phone, position, permissions, isActive } = req.body;

    // Check if email is being changed and if it already exists
    if (email !== admin.email) {
      const existingAdmin = await Admin.findByEmail(email);
      if (existingAdmin && existingAdmin.id !== admin.id) {
        return res.status(400).json({
          success: false,
          message: 'Admin with this email already exists'
        });
      }
    }

    // Prevent deactivating the last super admin
    if (admin.role === 'super_admin' && (!isActive || role !== 'super_admin')) {
      const superAdminCount = await Admin.count({
        where: { role: 'super_admin', isActive: true }
      });

      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate or demote the last super admin'
        });
      }
    }

    // Update admin
    await admin.update({
      name,
      email,
      role,
      phone,
      position,
      permissions: role === 'super_admin' ? ['all'] : permissions,
      isActive
    });

    logger.info(`Admin updated: ${admin.name} (${admin.email}) by ${req.admin.name}`);

    res.json({
      success: true,
      message: 'Admin updated successfully',
      data: admin.toJSON()
    });

  } catch (error) {
    logger.error('Update admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin'
    });
  }
});

// @route   DELETE /api/admin/:id
// @desc    Delete admin (super admin only)
// @access  Private (super admin only)
router.delete('/:id', requireSuperAdmin, [
  param('id').isUUID().withMessage('Invalid admin ID')
], logActivity('delete_admin'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const admin = await Admin.findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Prevent deleting self
    if (admin.id === req.admin.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Prevent deleting the last super admin
    if (admin.role === 'super_admin') {
      const superAdminCount = await Admin.count({
        where: { role: 'super_admin', isActive: true }
      });

      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last super admin'
        });
      }
    }

    const adminInfo = {
      name: admin.name,
      email: admin.email,
      id: admin.id
    };

    // Soft delete by setting inactive
    await admin.update({ isActive: false, refreshToken: null });

    logger.info(`Admin deleted: ${adminInfo.name} (${adminInfo.email}) by ${req.admin.name}`);

    res.json({
      success: true,
      message: 'Admin deleted successfully',
      data: { id: adminInfo.id, name: adminInfo.name }
    });

  } catch (error) {
    logger.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin'
    });
  }
});

// @route   PUT /api/admin/:id/password
// @desc    Update admin password (super admin only)
// @access  Private (super admin only)
router.put('/:id/password', requireSuperAdmin, [
  param('id').isUUID().withMessage('Invalid admin ID'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], logActivity('update_admin_password'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const admin = await Admin.findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const { password } = req.body;

    // Update password (will be hashed in the model hook)
    await admin.update({ 
      password,
      passwordChangedAt: new Date(),
      refreshToken: null // Invalidate all sessions
    });

    logger.info(`Admin password updated: ${admin.name} (${admin.email}) by ${req.admin.name}`);

    res.json({
      success: true,
      message: 'Admin password updated successfully'
    });

  } catch (error) {
    logger.error('Update admin password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin password'
    });
  }
});

// @route   GET /api/admin/:id/activity
// @desc    Get admin activity logs (super admin only)
// @access  Private (super admin only)
router.get('/:id/activity', requireSuperAdmin, [
  param('id').isUUID().withMessage('Invalid admin ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const admin = await Admin.findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // This would require an ActivityLog model - placeholder for now
    const activities = []; // await ActivityLog.findAll({ where: { adminId: admin.id }, offset, limit });

    res.json({
      success: true,
      message: 'Admin activities retrieved successfully',
      data: {
        activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: activities.length
        }
      }
    });

  } catch (error) {
    logger.error('Get admin activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin activities'
    });
  }
});

// @route   PUT /api/admin/:id/permissions
// @desc    Update admin permissions (super admin only)
// @access  Private (super admin only)
router.put('/:id/permissions', requireSuperAdmin, [
  param('id').isUUID().withMessage('Invalid admin ID'),
  body('permissions').isArray().withMessage('Permissions must be an array'),
  body('permissions.*').isString().withMessage('Each permission must be a string')
], logActivity('update_admin_permissions'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const admin = await Admin.findByPk(req.params.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const { permissions } = req.body;

    // Super admins always have all permissions
    if (admin.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify permissions for super admin'
      });
    }

    // Validate permissions (you can define available permissions)
    const validPermissions = [
      'manage_events', 'manage_members', 'manage_celebrations', 
      'view_reports', 'manage_announcements', 'manage_donations'
    ];

    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid permissions: ${invalidPermissions.join(', ')}`
      });
    }

    // Update permissions
    await admin.update({ permissions });

    logger.info(`Admin permissions updated: ${admin.name} (${admin.email}) by ${req.admin.name}`);

    res.json({
      success: true,
      message: 'Admin permissions updated successfully',
      data: { permissions: admin.permissions }
    });

  } catch (error) {
    logger.error('Update admin permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin permissions'
    });
  }
});

module.exports = router;