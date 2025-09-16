// controllers/attendanceController.js
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const { Attendance, MemberAttendance, Member, Admin } = require("../models");
const logger = require("../utils/logger");

const attendanceController = {
  // @desc    Get all attendance records with filtering
  // @route   GET /api/attendance
  // @access  Private
  getAttendanceRecords: async (req, res) => {
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
      const { count, rows: attendanceRecords } = await Attendance.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        include: [
          {
            model: Admin,
            as: "recordedBy",
            attributes: ["id", "name", "position"],
          },
          {
            model: MemberAttendance,
            as: "memberAttendances",
            include: [
              {
                model: Member,
                as: "member",
                attributes: ["id", "name", "department"],
              },
            ],
          },
        ],
      });

      // Calculate pagination info
      const totalPages = Math.ceil(count / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      // Format the data for frontend
      const formattedRecords = attendanceRecords.map(record => ({
        id: record.id,
        date: record.date,
        serviceType: record.serviceType,
        totalAttendance: record.totalAttendance,
        adults: record.adults,
        youth: record.youth,
        children: record.children,
        visitors: record.visitors,
        notes: record.notes,
        recordedBy: record.recordedBy?.name || 'Unknown',
        recordedById: record.recordedById,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        memberAttendances: record.memberAttendances?.map(ma => ({
          id: ma.id,
          memberId: ma.memberId,
          memberName: ma.member?.name,
          memberDepartment: ma.member?.department,
          present: ma.present,
          timeArrived: ma.timeArrived,
          notes: ma.notes
        })) || []
      }));

      res.json({
        success: true,
        message: "Attendance records retrieved successfully",
        data: formattedRecords,
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
  },

  // @desc    Get attendance statistics
  // @route   GET /api/attendance/stats
  // @access  Private
  getAttendanceStats: async (req, res) => {
    try {
      const { period = "month" } = req.query;

      const stats = await Attendance.getStatistics(period);

      res.json({
        success: true,
        message: "Attendance statistics retrieved successfully",
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
  },

  // @desc    Get available service types
  // @route   GET /api/attendance/service-types
  // @access  Private
  getServiceTypes: async (req, res) => {
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
        message: "Service types retrieved successfully",
        data: serviceTypes,
      });
    } catch (error) {
      logger.error("Get service types error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve service types",
      });
    }
  },

  // @desc    Get members for attendance tracking
  // @route   GET /api/attendance/members
  // @access  Private
  getMembersForAttendance: async (req, res) => {
    try {
      const members = await Member.findAll({
        where: { isActive: true },
        attributes: ["id", "name", "department"],
        order: [["name", "ASC"]],
      });

      res.json({
        success: true,
        message: "Members retrieved successfully",
        data: members,
      });
    } catch (error) {
      logger.error("Get members for attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve members",
      });
    }
  },

  // @desc    Get attendance record by ID
  // @route   GET /api/attendance/:id
  // @access  Private
  getAttendanceById: async (req, res) => {
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
            attributes: ["id", "name", "position"],
          },
          {
            model: MemberAttendance,
            as: "memberAttendances",
            include: [
              {
                model: Member,
                as: "member",
                attributes: ["id", "name", "department"],
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

      // Format the data for frontend
      const formattedAttendance = {
        id: attendance.id,
        date: attendance.date,
        serviceType: attendance.serviceType,
        totalAttendance: attendance.totalAttendance,
        adults: attendance.adults,
        youth: attendance.youth,
        children: attendance.children,
        visitors: attendance.visitors,
        notes: attendance.notes,
        recordedBy: attendance.recordedBy?.name || 'Unknown',
        recordedById: attendance.recordedById,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt,
        members: attendance.memberAttendances?.map(ma => ({
          memberId: ma.memberId,
          name: ma.member?.name,
          department: ma.member?.department,
          present: ma.present,
          timeArrived: ma.timeArrived,
          notes: ma.notes
        })) || []
      };

      res.json({
        success: true,
        message: "Attendance record retrieved successfully",
        data: formattedAttendance,
      });
    } catch (error) {
      logger.error("Get attendance record error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve attendance record",
      });
    }
  },

  // @desc    Create new attendance record
  // @route   POST /api/attendance
  // @access  Private
  createAttendance: async (req, res) => {
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
          message: "Attendance record already exists for this date and service type",
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
            notes: member.notes || null,
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
      if (io) {
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
      }

      // Fetch the created record with includes for response
      const createdRecord = await Attendance.findByPk(newAttendance.id, {
        include: [
          {
            model: Admin,
            as: "recordedBy",
            attributes: ["id", "name", "position"],
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: "Attendance recorded successfully",
        data: {
          id: createdRecord.id,
          date: createdRecord.date,
          serviceType: createdRecord.serviceType,
          totalAttendance: createdRecord.totalAttendance,
          adults: createdRecord.adults,
          youth: createdRecord.youth,
          children: createdRecord.children,
          visitors: createdRecord.visitors,
          notes: createdRecord.notes,
          recordedBy: createdRecord.recordedBy?.name,
          createdAt: createdRecord.createdAt,
        },
      });
    } catch (error) {
      logger.error("Create attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to record attendance",
      });
    }
  },

  // @desc    Update attendance record
  // @route   PUT /api/attendance/:id
  // @access  Private
  updateAttendance: async (req, res) => {
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
            message: "Another attendance record already exists for this date and service type",
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
            notes: member.notes || null,
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
      if (io) {
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
      }

      // Fetch updated record with includes
      const updatedRecord = await Attendance.findByPk(attendance.id, {
        include: [
          {
            model: Admin,
            as: "recordedBy",
            attributes: ["id", "name", "position"],
          },
        ],
      });

      res.json({
        success: true,
        message: "Attendance record updated successfully",
        data: {
          id: updatedRecord.id,
          date: updatedRecord.date,
          serviceType: updatedRecord.serviceType,
          totalAttendance: updatedRecord.totalAttendance,
          adults: updatedRecord.adults,
          youth: updatedRecord.youth,
          children: updatedRecord.children,
          visitors: updatedRecord.visitors,
          notes: updatedRecord.notes,
          recordedBy: updatedRecord.recordedBy?.name,
          updatedAt: updatedRecord.updatedAt,
        },
      });
    } catch (error) {
      logger.error("Update attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update attendance record",
      });
    }
  },

  // @desc    Delete attendance record
  // @route   DELETE /api/attendance/:id
  // @access  Private
  deleteAttendance: async (req, res) => {
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

      // Delete member attendance records first (cascading delete)
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
      if (io) {
        io.to("admin-room").emit("attendance-deleted", {
          attendance: attendanceInfo,
          deletedBy: req.admin.name,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Attendance record deleted successfully",
        data: { id: attendanceInfo.id },
      });
    } catch (error) {
      logger.error("Delete attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete attendance record",
      });
    }
  },

  // @desc    Generate attendance report
  // @route   POST /api/attendance/report
  // @access  Private
  generateReport: async (req, res) => {
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
          message: "Attendance report generated successfully",
          data: attendanceRecords.map(record => ({
            id: record.id,
            date: record.date,
            serviceType: record.serviceType,
            totalAttendance: record.totalAttendance,
            adults: record.adults,
            youth: record.youth,
            children: record.children,
            visitors: record.visitors,
            recordedBy: record.recordedBy?.name || "Unknown",
            createdAt: record.createdAt,
          })),
          count: attendanceRecords.length,
        });
      }

      logger.info(`Attendance report generated by ${req.admin.name} - Format: ${format}, Records: ${attendanceRecords.length}`);

    } catch (error) {
      logger.error("Generate attendance report error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate attendance report",
      });
    }
  },
};

module.exports = attendanceController;