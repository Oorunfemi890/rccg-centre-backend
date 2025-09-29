// controllers/adminController.js - Admin Management Logic
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const adminController = {
  // @desc    Get all admins (super admin only)
  // @route   GET /api/admin
  // @access  Private (super admin only)
  getAllAdmins: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

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
  },

  // @desc    Create new admin (super admin only)
  // @route   POST /api/admin
  // @access  Private (super admin only)
  createAdmin: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

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
  },

  // @desc    Get single admin by ID
  // @route   GET /api/admin/:id
  // @access  Private (super admin only)
  getAdminById: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const admin = await Admin.findByPk(req.params.id, {
        attributes: { exclude: ['password', 'refreshToken', 'passwordResetToken'] }
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      res.json({
        success: true,
        message: 'Admin retrieved successfully',
        data: admin
      });

    } catch (error) {
      logger.error('Get admin by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve admin'
      });
    }
  },

  // @desc    Update admin (super admin only)
  // @route   PUT /api/admin/:id
  // @access  Private (super admin only)
  updateAdmin: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

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
  },

  // @desc    Delete admin (super admin only)
  // @route   DELETE /api/admin/:id
  // @access  Private (super admin only)
  deleteAdmin: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

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
  },

  // @desc    Update admin password (super admin only)
  // @route   PUT /api/admin/:id/password
  // @access  Private (super admin only)
  updateAdminPassword: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

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
  },

  // @desc    Get admin activity logs (super admin only)
  // @route   GET /api/admin/:id/activity
  // @access  Private (super admin only)
  getAdminActivity: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

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
  },

  // @desc    Update admin permissions (super admin only)
  // @route   PUT /api/admin/:id/permissions
  // @access  Private (super admin only)
  updateAdminPermissions: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

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
        'manage_events', 
        'manage_members', 
        'manage_celebrations', 
        'view_reports', 
        'manage_announcements', 
        'manage_donations',
        'manage_attendance'
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
  },

  // @desc    Get admin statistics
  // @route   GET /api/admin/stats
  // @access  Private (super admin only)
  getAdminStats: async (req, res) => {
    try {
      // Get Admin model from req.db
      const { Admin } = req.db;

      const totalAdmins = await Admin.count();
      const activeAdmins = await Admin.count({ where: { isActive: true } });
      const inactiveAdmins = await Admin.count({ where: { isActive: false } });
      const superAdmins = await Admin.count({ where: { role: 'super_admin', isActive: true } });
      const regularAdmins = await Admin.count({ where: { role: 'admin', isActive: true } });

      res.json({
        success: true,
        message: 'Admin statistics retrieved successfully',
        data: {
          total: totalAdmins,
          active: activeAdmins,
          inactive: inactiveAdmins,
          superAdmins,
          regularAdmins
        }
      });

    } catch (error) {
      logger.error('Get admin stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve admin statistics'
      });
    }
  }
};

module.exports = adminController;