// routes/attendance.js
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { Op } = require("sequelize");
const router = express.Router();

const { Attendance, MemberAttendance, Member, Admin } = require("../models");
const { requirePermission, logActivity } = require("../middleware/auth");
const logger = require("../utils/logger");

// Validation rules
const createAttendanceValidation = [
  body("date").isDate().withMessage("Please provide a valid date"),
  body("serviceType")
    .notEmpty()
    .withMessage("Service type is required")
    .isIn([
      "Sunday Fire Service",
      "Sunday School",
      "Sunday Main Service",
      "Tuesday Bible Study",
      "Wednesday Prayer",
      "Thursday Faith Clinic",
      "Friday Night Service",
      "Holy Ghost Service",
      "Special Program",
    ])
    .withMessage("Invalid service type"),
  body("totalAttendance")
    .isInt({ min: 0 })
    .withMessage("Total attendance must be a non-negative number"),
  body("adults")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Adults count must be a non-negative number"),
  body("youth")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Youth count must be a non-negative number"),
  body("children")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Children count must be a non-negative number"),
  body("visitors")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Visitors count must be a non-negative number"),
];

const updateAttendanceValidation = [
  param("id").isUUID().withMessage("Invalid attendance ID"),
  ...createAttendanceValidation,
];

const attendanceIdValidation = [
  param("id").isUUID().withMessage("Invalid attendance ID"),
];

// @route   GET /api/attendance
// @desc    Get all attendance records with filtering
// @access  Private (requires attendance permission)
router.get("/", requirePermission("attendance"), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      serviceType = "all",
      sortBy = "date",
      sortOrder = "DESC",
    } = req.query;

    // Build where clause
    let whereClause = {};

    // Date range filter
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date[Op.gte] = startDate;
      if (endDate) whereClause.date[Op.lte] = endDate;
    }

    // Service type filter
    if (serviceType !== "all") {
      whereClause.serviceType = serviceType;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch attendance records
    const { count, rows: attendanceRecords } = await Attendance.findAndCountAll(
      {
        where: whereClause,
        limit: parseInt(limit),
        offset: offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        include: [
          {
            model: Admin,
            as: "recordedBy",
            attributes: ["name", "position"],
          },
          {
            model: MemberAttendance,
            as: "memberAttendances",
            include: [
              {
                model: Member,
                as: "member",
                attributes: ["name"],
              },
            ],
          },
        ],
      }
    );

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: "Attendance records retrieved successfully",
      data: attendanceRecords,
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
    logger.error("Get attendance records error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve attendance records",
    });
  }
});

// @route   GET /api/attendance/stats
// @desc    Get attendance statistics
// @access  Private (requires attendance permission)
router.get("/stats", requirePermission("attendance"), async (req, res) => {
  try {
    const { period = "month" } = req.query;

    const stats = await Attendance.getStatistics(period);

    res.json({
      success: true,
      data: stats[0] || {
        totalRecords: 0,
        totalAttendance: 0,
        averageAttendance: 0,
        highestAttendance: 0,
        lowestAttendance: 0,
      },
    });
  } catch (error) {
    logger.error("Get attendance statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve attendance statistics",
    });
  }
});

// @route   GET /api/attendance/service-types
// @desc    Get available service types
// @access  Private (requires attendance permission)
router.get(
  "/service-types",
  requirePermission("attendance"),
  async (req, res) => {
    try {
      const serviceTypes = [
        "Sunday Fire Service",
        "Sunday School",
        "Sunday Main Service",
        "Tuesday Bible Study",
        "Wednesday Prayer",
        "Thursday Faith Clinic",
        "Friday Night Service",
        "Holy Ghost Service",
        "Special Program",
      ];

      res.json({
        success: true,
        data: serviceTypes,
      });
    } catch (error) {
      logger.error("Get service types error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve service types",
      });
    }
  }
);

// @route   GET /api/attendance/members
// @desc    Get members for attendance tracking
// @access  Private (requires attendance permission)
router.get("/members", requirePermission("attendance"), async (req, res) => {
  try {
    const members = await Member.findAll({
      where: { isActive: true },
      attributes: ["id", "name", "department"],
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: members,
    });
  } catch (error) {
    logger.error("Get members for attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve members",
    });
  }
});

// @route   GET /api/attendance/:id
// @desc    Get attendance record by ID
// @access  Private (requires attendance permission)
router.get(
  "/:id",
  requirePermission("attendance"),
  attendanceIdValidation,
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

      const attendance = await Attendance.findByPk(req.params.id, {
        include: [
          {
            model: Admin,
            as: "recordedBy",
            attributes: ["name", "position"],
          },
          {
            model: MemberAttendance,
            as: "memberAttendances",
            include: [
              {
                model: Member,
                as: "member",
                attributes: ["name"],
              },
            ],
          },
        ],
      });

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: "Attendance record not found",
        });
      }

      res.json({
        success: true,
        message: "Attendance record retrieved successfully",
        data: attendance,
      });
    } catch (error) {
      logger.error("Get attendance record error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve attendance record",
      });
    }
  }
);

// @route   POST /api/attendance
// @desc    Create new attendance record
// @access  Private (requires attendance permission)
router.post(
  "/",
  requirePermission("attendance"),
  createAttendanceValidation,
  logActivity("create_attendance"),
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
        date,
        serviceType,
        totalAttendance,
        adults = 0,
        youth = 0,
        children = 0,
        visitors = 0,
        notes,
        members = [],
      } = req.body;

      // Check if attendance already exists for this date and service type
      const existingAttendance = await Attendance.findOne({
        where: { date, serviceType },
      });

      if (existingAttendance) {
        return res.status(400).json({
          success: false,
          message:
            "Attendance record already exists for this date and service type",
        });
      }

      // Create attendance record
      const newAttendance = await Attendance.create({
        date,
        serviceType,
        totalAttendance,
        adults,
        youth,
        children,
        visitors,
        notes,
        recordedById: req.admin.id,
      });

      // Create member attendance records if provided
      if (members && members.length > 0) {
        const memberAttendanceRecords = members
          .filter((member) => member.present)
          .map((member) => ({
            attendanceId: newAttendance.id,
            memberId: member.memberId,
            present: member.present,
            timeArrived: member.timeArrived || null,
          }));

        if (memberAttendanceRecords.length > 0) {
          await MemberAttendance.bulkCreate(memberAttendanceRecords);
        }
      }

      logger.info(
        `New attendance record created: ${serviceType} on ${date} by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("attendance-created", {
        attendance: {
          id: newAttendance.id,
          date: newAttendance.date,
          serviceType: newAttendance.serviceType,
          totalAttendance: newAttendance.totalAttendance,
        },
        recordedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Attendance recorded successfully",
        data: newAttendance,
      });
    } catch (error) {
      logger.error("Create attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to record attendance",
      });
    }
  }
);

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private (requires attendance permission)
router.put(
  "/:id",
  requirePermission("attendance"),
  updateAttendanceValidation,
  logActivity("update_attendance"),
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

      const attendance = await Attendance.findByPk(req.params.id);
      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: "Attendance record not found",
        });
      }

      const {
        date,
        serviceType,
        totalAttendance,
        adults,
        youth,
        children,
        visitors,
        notes,
        members = [],
      } = req.body;

      // Check if another attendance record exists for the new date/service combination
      if (date !== attendance.date || serviceType !== attendance.serviceType) {
        const existingAttendance = await Attendance.findOne({
          where: {
            date,
            serviceType,
            id: { [Op.not]: req.params.id },
          },
        });

        if (existingAttendance) {
          return res.status(400).json({
            success: false,
            message:
              "Another attendance record already exists for this date and service type",
          });
        }
      }

      // Update attendance record
      await attendance.update({
        date,
        serviceType,
        totalAttendance,
        adults,
        youth,
        children,
        visitors,
        notes,
      });

      // Update member attendance records
      if (members && members.length > 0) {
        // Delete existing member attendance records
        await MemberAttendance.destroy({
          where: { attendanceId: attendance.id },
        });

        // Create new member attendance records
        const memberAttendanceRecords = members
          .filter((member) => member.present)
          .map((member) => ({
            attendanceId: attendance.id,
            memberId: member.memberId,
            present: member.present,
            timeArrived: member.timeArrived || null,
          }));

        if (memberAttendanceRecords.length > 0) {
          await MemberAttendance.bulkCreate(memberAttendanceRecords);
        }
      }

      logger.info(
        `Attendance record updated: ${serviceType} on ${date} by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("attendance-updated", {
        attendance: {
          id: attendance.id,
          date: attendance.date,
          serviceType: attendance.serviceType,
          totalAttendance: attendance.totalAttendance,
        },
        updatedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Attendance record updated successfully",
        data: attendance,
      });
    } catch (error) {
      logger.error("Update attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update attendance record",
      });
    }
  }
);

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private (requires attendance permission)
router.delete(
  "/:id",
  requirePermission("attendance"),
  attendanceIdValidation,
  logActivity("delete_attendance"),
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

      const attendance = await Attendance.findByPk(req.params.id);
      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: "Attendance record not found",
        });
      }

      const attendanceInfo = {
        serviceType: attendance.serviceType,
        date: attendance.date,
        id: attendance.id,
      };

      // Delete member attendance records first
      await MemberAttendance.destroy({
        where: { attendanceId: attendance.id },
      });

      // Delete attendance record
      await attendance.destroy();

      logger.info(
        `Attendance record deleted: ${attendanceInfo.serviceType} on ${attendanceInfo.date} by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("attendance-deleted", {
        attendance: attendanceInfo,
        deletedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Attendance record deleted successfully",
      });
    } catch (error) {
      logger.error("Delete attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete attendance record",
      });
    }
  }
);

// @route   POST /api/attendance/report
// @desc    Generate attendance report (CSV)
// @access  Private (requires attendance permission)
router.post("/report", requirePermission("attendance"), async (req, res) => {
  try {
    const { startDate, endDate, serviceType, format = "csv" } = req.body;

    // Build where clause
    let whereClause = {};

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date[Op.gte] = startDate;
      if (endDate) whereClause.date[Op.lte] = endDate;
    }

    if (serviceType && serviceType !== "all") {
      whereClause.serviceType = serviceType;
    }

    const attendanceRecords = await Attendance.findAll({
      where: whereClause,
      include: [
        {
          model: Admin,
          as: "recordedBy",
          attributes: ["name"],
        },
      ],
      order: [["date", "DESC"]],
    });

    if (format === "csv") {
      // Generate CSV content
      const csvHeaders =
        "Date,Service Type,Total Attendance,Adults,Youth,Children,Visitors,Recorded By,Created At\n";
      const csvContent = attendanceRecords
        .map((record) =>
          [
            record.date,
            `"${record.serviceType}"`,
            record.totalAttendance,
            record.adults || 0,
            record.youth || 0,
            record.children || 0,
            record.visitors || 0,
            `"${record.recordedBy?.name || "Unknown"}"`,
            new Date(record.createdAt).toISOString().split("T")[0],
          ].join(",")
        )
        .join("\n");

      const fullCsv = csvHeaders + csvContent;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="attendance_report_${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
      res.send(fullCsv);
    } else {
      res.json({
        success: true,
        data: attendanceRecords,
        count: attendanceRecords.length,
      });
    }
  } catch (error) {
    logger.error("Generate attendance report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate attendance report",
    });
  }
});

module.exports = router;
