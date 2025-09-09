// routes/celebrations.js
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { Op } = require("sequelize");
const router = express.Router();

const { Celebration, Member, Admin } = require("../models");
const {
  authenticateToken,
  requirePermission,
  optionalAuth,
  logActivity,
} = require("../middleware/auth");
const logger = require("../utils/logger");
const emailService = require("../services/emailService");
const { uploadMiddleware } = require("../middleware/upload");

// Validation rules
const createCelebrationValidation = [
  body("type")
    .isIn([
      "Birthday",
      "Wedding Anniversary",
      "Graduation",
      "Promotion",
      "New Job",
      "New Baby",
      "House Dedication",
      "Other",
    ])
    .withMessage("Invalid celebration type"),
  body("name")
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Name must be between 2 and 200 characters"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email address"),
  body("message")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Message must be less than 1000 characters"),
  body("month")
    .isInt({ min: 1, max: 12 })
    .withMessage("Month must be between 1 and 12"),
  body("date")
    .isInt({ min: 1, max: 31 })
    .withMessage("Date must be between 1 and 31"),
  body("year")
    .optional()
    .isInt({ min: 1900, max: 2100 })
    .withMessage("Year must be between 1900 and 2100"),
];

const updateCelebrationStatusValidation = [
  param("id").isUUID().withMessage("Invalid celebration ID"),
  body("status")
    .isIn(["pending", "approved", "rejected"])
    .withMessage("Invalid status"),
  body("rejectionReason")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Rejection reason must be less than 500 characters"),
];

const celebrationIdValidation = [
  param("id").isUUID().withMessage("Invalid celebration ID"),
];

// @route   GET /api/celebrations
// @desc    Get all celebrations (admin only)
// @access  Private (requires celebrations permission)
router.get(
  "/",
  authenticateToken,
  requirePermission("celebrations"),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        status = "all",
        type = "all",
        search = "",
        sortBy = "createdAt",
        sortOrder = "DESC",
      } = req.query;

      // Build where clause
      let whereClause = {};

      if (status !== "all") {
        whereClause.status = status;
      }

      if (type !== "all") {
        whereClause.type = type;
      }

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { type: { [Op.iLike]: `%${search}%` } },
        ];
      }

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Fetch celebrations
      const { count, rows: celebrations } = await Celebration.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        include: [
          {
            model: Member,
            as: "member",
            attributes: ["name", "email", "phone", "department"],
          },
          {
            model: Admin,
            as: "approvedBy",
            attributes: ["name", "position"],
          },
        ],
      });

      // Calculate pagination info
      const totalPages = Math.ceil(count / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      res.json({
        success: true,
        message: "Celebrations retrieved successfully",
        data: celebrations,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords: count,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      logger.error("Get celebrations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve celebrations",
      });
    }
  }
);

// @route   GET /api/celebrations/stats
// @desc    Get celebration statistics
// @access  Private (requires celebrations permission)
router.get(
  "/stats",
  authenticateToken,
  requirePermission("celebrations"),
  async (req, res) => {
    try {
      const [
        totalCelebrations,
        pendingCelebrations,
        approvedCelebrations,
        rejectedCelebrations,
        thisMonthCelebrations,
        typeStats,
      ] = await Celebration.getStatistics();

      res.json({
        success: true,
        data: {
          totalCelebrations,
          pendingCelebrations,
          approvedCelebrations,
          rejectedCelebrations,
          thisMonthCelebrations,
          typeStats,
        },
      });
    } catch (error) {
      logger.error("Get celebration statistics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve celebration statistics",
      });
    }
  }
);

// @route   GET /api/celebrations/upcoming
// @desc    Get upcoming celebrations
// @access  Private (requires celebrations permission)
router.get(
  "/upcoming",
  authenticateToken,
  requirePermission("celebrations"),
  async (req, res) => {
    try {
      const { limit = 10, days = 30 } = req.query;

      const upcomingCelebrations = await Celebration.getUpcomingCelebrations(
        parseInt(days)
      );

      res.json({
        success: true,
        message: "Upcoming celebrations retrieved successfully",
        data: upcomingCelebrations.slice(0, parseInt(limit)),
      });
    } catch (error) {
      logger.error("Get upcoming celebrations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve upcoming celebrations",
      });
    }
  }
);

// @route   GET /api/celebrations/:id
// @desc    Get celebration by ID
// @access  Private (requires celebrations permission)
router.get(
  "/:id",
  authenticateToken,
  requirePermission("celebrations"),
  celebrationIdValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const celebration = await Celebration.findByPk(req.params.id, {
        include: [
          {
            model: Member,
            as: "member",
            attributes: ["name", "email", "phone", "department"],
          },
          {
            model: Admin,
            as: "approvedBy",
            attributes: ["name", "position"],
          },
        ],
      });

      if (!celebration) {
        return res.status(404).json({
          success: false,
          message: "Celebration not found",
        });
      }

      res.json({
        success: true,
        message: "Celebration details retrieved successfully",
        data: celebration,
      });
    } catch (error) {
      logger.error("Get celebration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve celebration details",
      });
    }
  }
);

// @route   POST /api/celebrations
// @desc    Submit celebration request (public endpoint)
// @access  Public
router.post(
  "/",
  uploadMiddleware.multiple("pictures", 5),
  createCelebrationValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { type, name, memberId, phone, email, message, month, date, year } =
        req.body;

      // Handle uploaded pictures
      let pictures = [];
      if (req.files && req.files.length > 0) {
        pictures = req.files.map((file) => file.path); // Cloudinary URLs
      }

      // Create celebration request
      const newCelebration = await Celebration.create({
        type,
        name,
        memberId: memberId || null,
        phone,
        email,
        message,
        month: parseInt(month),
        date: parseInt(date),
        year: year ? parseInt(year) : null,
        pictures,
        status: "pending",
      });

      logger.info(`New celebration request submitted: ${type} for ${name}`);

      // Emit real-time notification to admins
      const io = req.app.get("io");
      io.to("admin-room").emit("celebration-submitted", {
        celebration: {
          id: newCelebration.id,
          type: newCelebration.type,
          name: newCelebration.name,
        },
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Celebration request submitted successfully",
        data: newCelebration,
      });
    } catch (error) {
      logger.error("Create celebration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit celebration request",
      });
    }
  }
);

// @route   PATCH /api/celebrations/:id/status
// @desc    Update celebration status (approve/reject)
// @access  Private (requires celebrations permission)
router.patch(
  "/:id/status",
  authenticateToken,
  requirePermission("celebrations"),
  updateCelebrationStatusValidation,
  logActivity("update_celebration_status"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const celebration = await Celebration.findByPk(req.params.id, {
        include: [
          {
            model: Member,
            as: "member",
            attributes: ["name", "email"],
          },
        ],
      });

      if (!celebration) {
        return res.status(404).json({
          success: false,
          message: "Celebration not found",
        });
      }

      const { status, rejectionReason } = req.body;

      let updateData = {
        status,
        approvedById: req.admin.id,
      };

      if (status === "approved") {
        updateData.acknowledgedDate = new Date().toISOString().split("T")[0];
        updateData.rejectionReason = null;
      } else if (status === "rejected") {
        updateData.rejectionReason = rejectionReason;
        updateData.acknowledgedDate = null;
      }

      await celebration.update(updateData);

      // Send email notification if approved
      if (status === "approved") {
        try {
          await emailService.sendCelebrationApprovalEmail(celebration);
        } catch (emailError) {
          logger.error("Failed to send approval email:", emailError);
          // Don't fail the request if email fails
        }
      }

      logger.info(
        `Celebration ${status}: ${celebration.name} (${celebration.id}) by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("celebration-status-updated", {
        celebration: {
          id: celebration.id,
          name: celebration.name,
          type: celebration.type,
          status,
        },
        updatedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: `Celebration ${status} successfully`,
        data: celebration,
      });
    } catch (error) {
      logger.error("Update celebration status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update celebration status",
      });
    }
  }
);

// @route   DELETE /api/celebrations/:id
// @desc    Delete celebration
// @access  Private (requires celebrations permission)
router.delete(
  "/:id",
  authenticateToken,
  requirePermission("celebrations"),
  celebrationIdValidation,
  logActivity("delete_celebration"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const celebration = await Celebration.findByPk(req.params.id);
      if (!celebration) {
        return res.status(404).json({
          success: false,
          message: "Celebration not found",
        });
      }

      const celebrationInfo = {
        name: celebration.name,
        type: celebration.type,
        id: celebration.id,
      };

      await celebration.destroy();

      logger.info(
        `Celebration deleted: ${celebrationInfo.name} (${celebrationInfo.id}) by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("celebration-deleted", {
        celebration: celebrationInfo,
        deletedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Celebration deleted successfully",
      });
    } catch (error) {
      logger.error("Delete celebration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete celebration",
      });
    }
  }
);

// @route   GET /api/celebrations/export
// @desc    Export celebrations to CSV
// @access  Private (requires celebrations permission)
router.get(
  "/export",
  authenticateToken,
  requirePermission("celebrations"),
  async (req, res) => {
    try {
      const { format = "csv", status = "all", type = "all" } = req.query;

      // Build where clause
      let whereClause = {};
      if (status !== "all") {
        whereClause.status = status;
      }
      if (type !== "all") {
        whereClause.type = type;
      }

      const celebrations = await Celebration.findAll({
        where: whereClause,
        include: [
          {
            model: Member,
            as: "member",
            attributes: ["name", "email", "department"],
          },
          {
            model: Admin,
            as: "approvedBy",
            attributes: ["name"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      if (format === "csv") {
        // Generate CSV content
        const csvHeaders =
          "Name,Type,Phone,Email,Month,Date,Status,Message,Submitted Date,Acknowledged Date,Approved By\n";
        const csvContent = celebrations
          .map((celebration) =>
            [
              `"${celebration.name}"`,
              `"${celebration.type}"`,
              `"${celebration.phone}"`,
              `"${celebration.email || ""}"`,
              celebration.month,
              celebration.date,
              celebration.status,
              `"${celebration.message || ""}"`,
              new Date(celebration.createdAt).toISOString().split("T")[0],
              celebration.acknowledgedDate || "",
              `"${celebration.approvedBy?.name || ""}"`,
            ].join(",")
          )
          .join("\n");

        const fullCsv = csvHeaders + csvContent;

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="celebrations_export_${
            new Date().toISOString().split("T")[0]
          }.csv"`
        );
        res.send(fullCsv);
      } else {
        res.json({
          success: true,
          data: celebrations,
          count: celebrations.length,
        });
      }
    } catch (error) {
      logger.error("Export celebrations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export celebrations",
      });
    }
  }
);

module.exports = router;
