// controllers/celebrationController.js - Backend Controller
const { Op } = require('sequelize');
const { Celebration, Member, Admin } = require('../models');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const { deleteImage } = require('../config/cloudinary');

const celebrationController = {
  // Get all celebrations with filtering and pagination (Admin only)
  getCelebrations: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        status = 'all',
        type = 'all',
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        memberType = 'all' // 'member', 'public', 'all'
      } = req.query;

      // Build where clause
      let whereClause = {};

      if (status !== 'all') {
        whereClause.status = status;
      }

      if (type !== 'all') {
        whereClause.type = type;
      }

      if (memberType === 'member') {
        whereClause.memberId = { [Op.not]: null };
      } else if (memberType === 'public') {
        whereClause.memberId = null;
      }

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { type: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Fetch celebrations with member and admin data
      const { count, rows: celebrations } = await Celebration.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        include: [
          {
            model: Member,
            as: 'member',
            attributes: ['id', 'name', 'email', 'phone', 'department'],
            required: false
          },
          {
            model: Admin,
            as: 'approvedBy',
            attributes: ['id', 'name', 'position'],
            required: false
          }
        ]
      });

      // Add derived fields
      const enrichedCelebrations = celebrations.map(celebration => {
        const celebrationData = celebration.toJSON();
        return {
          ...celebrationData,
          isFromMember: !!celebration.memberId,
          source: celebration.memberId ? 'member' : 'public',
          upcomingDays: celebration.daysUntilCelebration(),
          isUpcoming: celebration.isUpcoming()
        };
      });

      // Calculate pagination info
      const totalPages = Math.ceil(count / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      res.json({
        success: true,
        message: 'Celebrations retrieved successfully',
        data: enrichedCelebrations,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords: count,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Get celebrations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve celebrations'
      });
    }
  },

  // Get celebration statistics
  getCelebrationsStats: async (req, res) => {
    try {
      const thisMonth = new Date();
      thisMonth.setDate(1);

      const [
        totalCelebrations,
        pendingCelebrations,
        approvedCelebrations,
        rejectedCelebrations,
        thisMonthCelebrations,
        memberCelebrations,
        publicCelebrations,
        typeStats
      ] = await Promise.all([
        Celebration.count(), // Total celebrations
        Celebration.count({ where: { status: 'pending' } }), // Pending
        Celebration.count({ where: { status: 'approved' } }), // Approved  
        Celebration.count({ where: { status: 'rejected' } }), // Rejected
        Celebration.count({
          where: {
            createdAt: {
              [Op.gte]: thisMonth
            }
          }
        }), // This month submissions
        Celebration.count({ where: { memberId: { [Op.not]: null } } }), // From members
        Celebration.count({ where: { memberId: null } }), // From public
        Celebration.findAll({
          attributes: [
            'type', 
            [Celebration.sequelize.fn('COUNT', Celebration.sequelize.col('id')), 'count']
          ],
          where: { status: 'approved' },
          group: ['type'],
          raw: true
        }) // Type breakdown
      ]);

      res.json({
        success: true,
        data: {
          totalCelebrations,
          pendingCelebrations,
          approvedCelebrations,
          rejectedCelebrations,
          thisMonthCelebrations,
          memberCelebrations,
          publicCelebrations,
          typeStats: typeStats.reduce((acc, stat) => {
            acc[stat.type] = parseInt(stat.count);
            return acc;
          }, {}),
          memberVsPublicRatio: {
            members: memberCelebrations,
            public: publicCelebrations,
            total: totalCelebrations
          }
        }
      });
    } catch (error) {
      logger.error('Get celebration statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve celebration statistics'
      });
    }
  },

  // Get upcoming celebrations
  getUpcomingCelebrations: async (req, res) => {
    try {
      const { limit = 10, days = 30 } = req.query;

      const upcomingCelebrations = await Celebration.getUpcomingCelebrations(
        parseInt(days)
      );

      const enrichedCelebrations = upcomingCelebrations.map(celebration => ({
        ...celebration.toJSON(),
        isFromMember: !!celebration.memberId,
        source: celebration.memberId ? 'member' : 'public',
        upcomingDays: celebration.daysUntilCelebration(),
        isUpcoming: celebration.isUpcoming()
      }));

      res.json({
        success: true,
        message: 'Upcoming celebrations retrieved successfully',
        data: enrichedCelebrations.slice(0, parseInt(limit))
      });
    } catch (error) {
      logger.error('Get upcoming celebrations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve upcoming celebrations'
      });
    }
  },

  // Get celebration by ID
  getCelebrationById: async (req, res) => {
    try {
      const { id } = req.params;

      const celebration = await Celebration.findByPk(id, {
        include: [
          {
            model: Member,
            as: 'member',
            attributes: ['id', 'name', 'email', 'phone', 'department'],
            required: false
          },
          {
            model: Admin,
            as: 'approvedBy',
            attributes: ['id', 'name', 'position'],
            required: false
          }
        ]
      });

      if (!celebration) {
        return res.status(404).json({
          success: false,
          message: 'Celebration not found'
        });
      }

      const celebrationData = celebration.toJSON();

      res.json({
        success: true,
        message: 'Celebration details retrieved successfully',
        data: {
          ...celebrationData,
          isFromMember: !!celebration.memberId,
          source: celebration.memberId ? 'member' : 'public',
          upcomingDays: celebration.daysUntilCelebration(),
          isUpcoming: celebration.isUpcoming()
        }
      });
    } catch (error) {
      logger.error('Get celebration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve celebration details'
      });
    }
  },

  // Submit celebration request (Public endpoint)
  submitCelebration: async (req, res) => {
    try {
      const { type, name, memberId, phone, email, message, month, date, year } = req.body;

      // Handle uploaded pictures
      let pictures = [];
      if (req.files && req.files.length > 0) {
        pictures = req.files.map(file => file.path); // Cloudinary URLs
      }

      // Check if this is from a known member by phone/email
      let resolvedMemberId = memberId || null;
      if (!memberId && (phone || email)) {
        const whereClause = {};
        if (phone) whereClause.phone = phone;
        if (email) whereClause.email = email;
        
        const member = await Member.findOne({
          where: {
            [Op.or]: Object.entries(whereClause).map(([key, value]) => ({ [key]: value }))
          }
        });
        
        if (member) {
          resolvedMemberId = member.id;
          logger.info(`Matched celebration to member: ${member.name} (${member.id})`);
        }
      }

      // Create celebration request
      const newCelebration = await Celebration.create({
        type,
        name,
        memberId: resolvedMemberId,
        phone,
        email,
        message,
        month: parseInt(month),
        date: parseInt(date),
        year: year ? parseInt(year) : null,
        pictures,
        status: 'pending'
      });

      logger.info(`New celebration request submitted: ${type} for ${name}`, {
        celebrationId: newCelebration.id,
        source: resolvedMemberId ? 'member' : 'public',
        memberId: resolvedMemberId
      });

      // Emit real-time notification to admins
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('celebration-submitted', {
          celebration: {
            id: newCelebration.id,
            type: newCelebration.type,
            name: newCelebration.name,
            source: resolvedMemberId ? 'member' : 'public'
          },
          timestamp: new Date()
        });
      }

      // Send confirmation email if email is provided
      if (email) {
        try {
          // await emailService.sendCelebrationConfirmationEmail(newCelebration);
          logger.info(`Confirmation email sent to: ${email}`);
        } catch (emailError) {
          logger.error('Failed to send confirmation email:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.status(201).json({
        success: true,
        message: 'Celebration request submitted successfully! We will review it shortly.',
        data: {
          id: newCelebration.id,
          type: newCelebration.type,
          name: newCelebration.name,
          status: newCelebration.status,
          submissionDate: newCelebration.createdAt
        }
      });
    } catch (error) {
      logger.error('Submit celebration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit celebration request. Please try again.'
      });
    }
  },

  // Update celebration status (approve/reject) - Admin only
  updateCelebrationStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, rejectionReason } = req.body;

      const celebration = await Celebration.findByPk(id, {
        include: [
          {
            model: Member,
            as: 'member',
            attributes: ['name', 'email'],
            required: false
          }
        ]
      });

      if (!celebration) {
        return res.status(404).json({
          success: false,
          message: 'Celebration not found'
        });
      }

      let updateData = {
        status,
        approvedById: req.admin.id
      };

      if (status === 'approved') {
        updateData.acknowledgedDate = new Date().toISOString().split('T')[0];
        updateData.rejectionReason = null;
      } else if (status === 'rejected') {
        updateData.rejectionReason = rejectionReason;
        updateData.acknowledgedDate = null;
      }

      await celebration.update(updateData);

      // Send email notification if approved and email is available
      if (status === 'approved' && (celebration.email || celebration.member?.email)) {
        try {
          // await emailService.sendCelebrationApprovalEmail(celebration);
          logger.info(`Approval email sent for celebration: ${celebration.id}`);
        } catch (emailError) {
          logger.error('Failed to send approval email:', emailError);
          // Don't fail the request if email fails
        }
      }

      logger.info(
        `Celebration ${status}: ${celebration.name} (${celebration.id}) by ${req.admin.name}`,
        {
          celebrationId: celebration.id,
          adminId: req.admin.id,
          source: celebration.memberId ? 'member' : 'public'
        }
      );

      // Emit real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('celebration-status-updated', {
          celebration: {
            id: celebration.id,
            name: celebration.name,
            type: celebration.type,
            status,
            source: celebration.memberId ? 'member' : 'public'
          },
          updatedBy: req.admin.name,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: `Celebration ${status} successfully`,
        data: celebration
      });
    } catch (error) {
      logger.error('Update celebration status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update celebration status'
      });
    }
  },

  // Delete celebration - Admin only
  deleteCelebration: async (req, res) => {
    try {
      const { id } = req.params;

      const celebration = await Celebration.findByPk(id);
      if (!celebration) {
        return res.status(404).json({
          success: false,
          message: 'Celebration not found'
        });
      }

      const celebrationInfo = {
        name: celebration.name,
        type: celebration.type,
        id: celebration.id,
        source: celebration.memberId ? 'member' : 'public'
      };

      // Delete associated images from Cloudinary
      if (celebration.pictures && celebration.pictures.length > 0) {
        try {
          for (const pictureUrl of celebration.pictures) {
            // Extract public_id from Cloudinary URL
            const matches = pictureUrl.match(/\/church-admin\/(.+)\./);
            if (matches && matches[1]) {
              await deleteImage(`church-admin/${matches[1]}`);
            }
          }
        } catch (imageDeleteError) {
          logger.error('Failed to delete images from Cloudinary:', imageDeleteError);
        }
      }

      await celebration.destroy();

      logger.info(
        `Celebration deleted: ${celebrationInfo.name} (${celebrationInfo.id}) by ${req.admin.name}`,
        {
          celebrationId: celebrationInfo.id,
          adminId: req.admin.id,
          source: celebrationInfo.source
        }
      );

      // Emit real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('celebration-deleted', {
          celebration: celebrationInfo,
          deletedBy: req.admin.name,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Celebration deleted successfully'
      });
    } catch (error) {
      logger.error('Delete celebration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete celebration'
      });
    }
  },

  // Export celebrations to CSV - Admin only
  exportCelebrations: async (req, res) => {
    try {
      const { format = 'csv', status = 'all', type = 'all', memberType = 'all' } = req.query;

      // Build where clause
      let whereClause = {};
      if (status !== 'all') {
        whereClause.status = status;
      }
      if (type !== 'all') {
        whereClause.type = type;
      }
      if (memberType === 'member') {
        whereClause.memberId = { [Op.not]: null };
      } else if (memberType === 'public') {
        whereClause.memberId = null;
      }

      const celebrations = await Celebration.findAll({
        where: whereClause,
        include: [
          {
            model: Member,
            as: 'member',
            attributes: ['name', 'email', 'department'],
            required: false
          },
          {
            model: Admin,
            as: 'approvedBy',
            attributes: ['name'],
            required: false
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      if (format === 'csv') {
        // Generate CSV content
        const csvHeaders = 'Name,Type,Phone,Email,Source,Month,Date,Status,Message,Submitted Date,Acknowledged Date,Approved By\n';
        const csvContent = celebrations
          .map(celebration =>
            [
              `"${celebration.name}"`,
              `"${celebration.type}"`,
              `"${celebration.phone}"`,
              `"${celebration.email || ''}"`,
              `"${celebration.memberId ? 'Member' : 'Public'}"`,
              celebration.month,
              celebration.date,
              celebration.status,
              `"${celebration.message || ''}"`,
              new Date(celebration.createdAt).toISOString().split('T')[0],
              celebration.acknowledgedDate || '',
              `"${celebration.approvedBy?.name || ''}"`
            ].join(',')
          )
          .join('\n');

        const fullCsv = csvHeaders + csvContent;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="celebrations_export_${new Date().toISOString().split('T')[0]}.csv"`
        );
        res.send(fullCsv);
      } else {
        // Return JSON format with enriched data
        const enrichedData = celebrations.map(celebration => ({
          ...celebration.toJSON(),
          source: celebration.memberId ? 'member' : 'public',
          isFromMember: !!celebration.memberId
        }));

        res.json({
          success: true,
          data: enrichedData,
          count: enrichedData.length
        });
      }
    } catch (error) {
      logger.error('Export celebrations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export celebrations'
      });
    }
  },

  // Get today's celebrations - Admin only
  getTodaysCelebrations: async (req, res) => {
    try {
      const todaysCelebrations = await Celebration.getTodaysCelebrations();
      
      const enrichedCelebrations = todaysCelebrations.map(celebration => ({
        ...celebration.toJSON(),
        isFromMember: !!celebration.memberId,
        source: celebration.memberId ? 'member' : 'public'
      }));

      res.json({
        success: true,
        message: "Today's celebrations retrieved successfully",
        data: enrichedCelebrations
      });
    } catch (error) {
      logger.error("Get today's celebrations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve today's celebrations"
      });
    }
  },

  // Get celebrations by month - Admin only
  getCelebrationsByMonth: async (req, res) => {
    try {
      const { month, year = new Date().getFullYear() } = req.query;

      if (!month || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: 'Valid month (1-12) is required'
        });
      }

      const celebrations = await Celebration.getCelebrationsByMonth(
        parseInt(month), 
        parseInt(year)
      );
      
      const enrichedCelebrations = celebrations.map(celebration => ({
        ...celebration.toJSON(),
        isFromMember: !!celebration.memberId,
        source: celebration.memberId ? 'member' : 'public'
      }));

      res.json({
        success: true,
        message: 'Monthly celebrations retrieved successfully',
        data: enrichedCelebrations
      });
    } catch (error) {
      logger.error('Get monthly celebrations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve monthly celebrations'
      });
    }
  },

  // Get pending celebrations count - For dashboard
  getPendingCount: async (req, res) => {
    try {
      const pendingCount = await Celebration.count({
        where: { status: 'pending' }
      });

      res.json({
        success: true,
        data: { count: pendingCount }
      });
    } catch (error) {
      logger.error('Get pending count error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending celebrations count'
      });
    }
  },

  // Bulk approve celebrations - Admin only
  bulkApproveCelebrations: async (req, res) => {
    try {
      const { celebrationIds } = req.body;

      if (!Array.isArray(celebrationIds) || celebrationIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of celebration IDs'
        });
      }

      const updateData = {
        status: 'approved',
        approvedById: req.admin.id,
        acknowledgedDate: new Date().toISOString().split('T')[0]
      };

      const [updatedCount] = await Celebration.update(updateData, {
        where: {
          id: celebrationIds,
          status: 'pending'
        }
      });

      logger.info(
        `Bulk approved ${updatedCount} celebrations by ${req.admin.name}`,
        { celebrationIds, adminId: req.admin.id }
      );

      // Emit real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('celebrations-bulk-approved', {
          count: updatedCount,
          approvedBy: req.admin.name,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: `Successfully approved ${updatedCount} celebrations`,
        data: { updatedCount }
      });
    } catch (error) {
      logger.error('Bulk approve celebrations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk approve celebrations'
      });
    }
  },

  // Get celebration trends - For analytics
  getCelebrationTrends: async (req, res) => {
    try {
      const { months = 6 } = req.query;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(months));

      const trends = await Celebration.findAll({
        attributes: [
          [Celebration.sequelize.fn('DATE_TRUNC', 'month', Celebration.sequelize.col('createdAt')), 'month'],
          [Celebration.sequelize.fn('COUNT', Celebration.sequelize.col('id')), 'count'],
          'status'
        ],
        where: {
          createdAt: {
            [Op.gte]: startDate
          }
        },
        group: [
          Celebration.sequelize.fn('DATE_TRUNC', 'month', Celebration.sequelize.col('createdAt')),
          'status'
        ],
        order: [[Celebration.sequelize.fn('DATE_TRUNC', 'month', Celebration.sequelize.col('createdAt')), 'ASC']],
        raw: true
      });

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      logger.error('Get celebration trends error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve celebration trends'
      });
    }
  }
};

module.exports = celebrationController;