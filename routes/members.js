// routes/members.js
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { Op } = require("sequelize");
const router = express.Router();

const { Member } = require("../models");
const { requirePermission, logActivity } = require("../middleware/auth");
const logger = require("../utils/logger");
const { uploadMiddleware } = require("../middleware/upload");

// Validation rules
const createMemberValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("membershipDate")
    .isDate()
    .withMessage("Please provide a valid membership date"),
  body("department")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Department must be less than 100 characters"),
];

const updateMemberValidation = [
  param("id").isUUID().withMessage("Invalid member ID"),
  ...createMemberValidation,
];

const memberIdValidation = [
  param("id").isUUID().withMessage("Invalid member ID"),
];

// @route   GET /api/members
// @desc    Get all members with filtering and pagination
// @access  Private (requires members permission)
router.get("/", requirePermission("members"), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      department = "all",
      sortBy = "name",
      sortOrder = "ASC",
    } = req.query;

    // Build where clause
    let whereClause = {};

    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    // Status filter
    if (status !== "all") {
      whereClause.isActive = status === "active";
    }

    // Department filter
    if (department !== "all") {
      whereClause.department = department;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch members
    const { count, rows: members } = await Member.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      attributes: { exclude: ["createdAt", "updatedAt"] },
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: "Members retrieved successfully",
      data: members,
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
    logger.error("Get members error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve members",
    });
  }
});

// @route   GET /api/members/stats
// @desc    Get member statistics
// @access  Private (requires members permission)
router.get("/stats", requirePermission("members"), async (req, res) => {
  try {
    const [
      totalMembers,
      activeMembers,
      inactiveMembers,
      departmentStats,
      genderStats,
    ] = await Member.getStatistics();

    // Get recent joins (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentJoins = await Member.findAll({
      where: {
        membershipDate: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
      order: [["membershipDate", "DESC"]],
      limit: 10,
      attributes: ["id", "name", "membershipDate"],
    });

    res.json({
      success: true,
      data: {
        totalMembers,
        activeMembers,
        inactiveMembers,
        departmentStats,
        genderStats,
        recentJoins,
      },
    });
  } catch (error) {
    logger.error("Get member statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve member statistics",
    });
  }
});

// @route   GET /api/members/departments
// @desc    Get list of departments
// @access  Private (requires members permission)
router.get("/departments", requirePermission("members"), async (req, res) => {
  try {
    const departments = await Member.findAll({
      attributes: ["department"],
      where: {
        department: { [Op.not]: null },
        isActive: true,
      },
      group: ["department"],
      order: [["department", "ASC"]],
    });

    const departmentList = departments.map((d) => d.department).filter(Boolean);

    res.json({
      success: true,
      data: departmentList,
    });
  } catch (error) {
    logger.error("Get departments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve departments",
    });
  }
});

// @route   GET /api/members/search
// @desc    Search members
// @access  Private (requires members permission)
router.get(
  "/search",
  requirePermission("members"),
  [query("q").notEmpty().withMessage("Search query is required")],
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

      const { q: searchTerm } = req.query;
      const members = await Member.searchMembers(searchTerm);

      res.json({
        success: true,
        message: `Found ${members.length} members`,
        data: members,
      });
    } catch (error) {
      logger.error("Search members error:", error);
      res.status(500).json({
        success: false,
        message: "Search failed",
      });
    }
  }
);

// @route   GET /api/members/:id
// @desc    Get member by ID
// @access  Private (requires members permission)
router.get(
  "/:id",
  requirePermission("members"),
  memberIdValidation,
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

      const member = await Member.findByPk(req.params.id, {
        include: [
          {
            association: "celebrations",
            attributes: ["id", "type", "status", "celebrationDate"],
          },
        ],
      });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }

      res.json({
        success: true,
        message: "Member retrieved successfully",
        data: member,
      });
    } catch (error) {
      logger.error("Get member error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve member",
      });
    }
  }
);

// @route   POST /api/members
// @desc    Create new member
// @access  Private (requires members permission)
router.post(
  "/",
  requirePermission("members"),
  createMemberValidation,
  logActivity("create_member"),
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

      const {
        name,
        email,
        phone,
        address,
        dateOfBirth,
        gender,
        maritalStatus,
        occupation,
        department,
        membershipDate,
        emergencyContact,
      } = req.body;

      // Check if email already exists
      const existingMember = await Member.findOne({ where: { email } });
      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: "A member with this email already exists",
        });
      }

      // Create new member
      const newMember = await Member.create({
        name,
        email,
        phone,
        address,
        dateOfBirth,
        gender,
        maritalStatus,
        occupation,
        department,
        membershipDate,
        emergencyContactName: emergencyContact?.name,
        emergencyContactPhone: emergencyContact?.phone,
        emergencyContactRelationship: emergencyContact?.relationship,
        isActive: true,
      });

      logger.info(
        `New member created: ${newMember.name} (${newMember.id}) by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("member-created", {
        member: {
          id: newMember.id,
          name: newMember.name,
          email: newMember.email,
        },
        createdBy: req.admin.name,
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Member created successfully",
        data: newMember,
      });
    } catch (error) {
      logger.error("Create member error:", error);

      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(400).json({
          success: false,
          message: "A member with this email already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create member",
      });
    }
  }
);

// @route   PUT /api/members/:id
// @desc    Update member
// @access  Private (requires members permission)
router.put(
  "/:id",
  requirePermission("members"),
  updateMemberValidation,
  logActivity("update_member"),
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

      const member = await Member.findByPk(req.params.id);
      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }

      const {
        name,
        email,
        phone,
        address,
        dateOfBirth,
        gender,
        maritalStatus,
        occupation,
        department,
        membershipDate,
        isActive,
        emergencyContact,
      } = req.body;

      // Check if email is being changed and if it already exists
      if (email !== member.email) {
        const existingMember = await Member.findOne({
          where: {
            email,
            id: { [Op.not]: req.params.id },
          },
        });

        if (existingMember) {
          return res.status(400).json({
            success: false,
            message: "A member with this email already exists",
          });
        }
      }

      // Update member
      await member.update({
        name,
        email,
        phone,
        address,
        dateOfBirth,
        gender,
        maritalStatus,
        occupation,
        department,
        membershipDate,
        isActive,
        emergencyContactName: emergencyContact?.name,
        emergencyContactPhone: emergencyContact?.phone,
        emergencyContactRelationship: emergencyContact?.relationship,
      });

      logger.info(
        `Member updated: ${member.name} (${member.id}) by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("member-updated", {
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
        },
        updatedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Member updated successfully",
        data: member,
      });
    } catch (error) {
      logger.error("Update member error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update member",
      });
    }
  }
);

// @route   PATCH /api/members/:id/status
// @desc    Update member status (active/inactive)
// @access  Private (requires members permission)
router.patch(
  "/:id/status",
  requirePermission("members"),
  memberIdValidation,
  [
    body("isActive")
      .isBoolean()
      .withMessage("isActive must be a boolean value"),
  ],
  logActivity("update_member_status"),
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

      const member = await Member.findByPk(req.params.id);
      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }

      const { isActive } = req.body;
      await member.update({ isActive });

      logger.info(
        `Member status updated: ${member.name} (${member.id}) - ${
          isActive ? "Active" : "Inactive"
        } by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("member-status-updated", {
        member: {
          id: member.id,
          name: member.name,
          isActive,
        },
        updatedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Member status updated successfully",
        data: member,
      });
    } catch (error) {
      logger.error("Update member status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update member status",
      });
    }
  }
);

// @route   DELETE /api/members/:id
// @desc    Soft delete member (set inactive)
// @access  Private (requires members permission)
router.delete(
  "/:id",
  requirePermission("members"),
  memberIdValidation,
  logActivity("delete_member"),
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

      const member = await Member.findByPk(req.params.id);
      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }

      // Soft delete by setting inactive
      await member.update({ isActive: false });

      logger.info(
        `Member soft deleted: ${member.name} (${member.id}) by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("member-deleted", {
        member: {
          id: member.id,
          name: member.name,
        },
        deletedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Member deleted successfully",
      });
    } catch (error) {
      logger.error("Delete member error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete member",
      });
    }
  }
);

// @route   GET /api/members/export
// @desc    Export members to CSV
// @access  Private (requires members permission)
router.get("/export", requirePermission("members"), async (req, res) => {
  try {
    const { format = "csv", status = "all", department = "all" } = req.query;

    // Build where clause
    let whereClause = {};
    if (status !== "all") {
      whereClause.isActive = status === "active";
    }
    if (department !== "all") {
      whereClause.department = department;
    }

    const members = await Member.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    if (format === "csv") {
      // Generate CSV content
      const csvHeaders =
        "Name,Email,Phone,Department,Status,Membership Date,Date of Birth,Gender,Marital Status,Occupation,Address\n";
      const csvContent = members
        .map((member) =>
          [
            `"${member.name}"`,
            `"${member.email}"`,
            `"${member.phone}"`,
            `"${member.department || ""}"`,
            member.isActive ? "Active" : "Inactive",
            member.membershipDate || "",
            member.dateOfBirth || "",
            member.gender || "",
            member.maritalStatus || "",
            `"${member.occupation || ""}"`,
            `"${member.address || ""}"`,
          ].join(",")
        )
        .join("\n");

      const fullCsv = csvHeaders + csvContent;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="members_export_${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
      res.send(fullCsv);
    } else {
      res.json({
        success: true,
        data: members,
        count: members.length,
      });
    }
  } catch (error) {
    logger.error("Export members error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export members",
    });
  }
});

module.exports = router;
