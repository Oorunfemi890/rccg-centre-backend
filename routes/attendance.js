// routes/attendance.js - Updated with controller separation
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const router = express.Router();

const attendanceController = require("../controllers/attendanceController");
const { requirePermission, logActivity } = require("../middleware/auth");

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
  body("notes")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Notes must be a string with maximum 1000 characters"),
  body("members")
    .optional()
    .isArray()
    .withMessage("Members must be an array"),
  body("members.*.memberId")
    .optional()
    .isUUID()
    .withMessage("Member ID must be a valid UUID"),
  body("members.*.present")
    .optional()
    .isBoolean()
    .withMessage("Present must be a boolean"),
  body("members.*.timeArrived")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Time arrived must be in HH:MM format"),
];

const updateAttendanceValidation = [
  param("id").isUUID().withMessage("Invalid attendance ID"),
  ...createAttendanceValidation,
];

const attendanceIdValidation = [
  param("id").isUUID().withMessage("Invalid attendance ID"),
];

const reportValidation = [
  body("startDate")
    .optional()
    .isDate()
    .withMessage("Start date must be a valid date"),
  body("endDate")
    .optional()
    .isDate()
    .withMessage("End date must be a valid date"),
  body("serviceType")
    .optional()
    .isString()
    .withMessage("Service type must be a string"),
  body("format")
    .optional()
    .isIn(["csv", "json"])
    .withMessage("Format must be either 'csv' or 'json'"),
];

const queryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("startDate")
    .optional()
    .isDate()
    .withMessage("Start date must be a valid date"),
  query("endDate")
    .optional()
    .isDate()
    .withMessage("End date must be a valid date"),
  query("serviceType")
    .optional()
    .isString()
    .withMessage("Service type must be a string"),
  query("sortBy")
    .optional()
    .isIn(["date", "serviceType", "totalAttendance", "createdAt"])
    .withMessage("Sort by must be one of: date, serviceType, totalAttendance, createdAt"),
  query("sortOrder")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Sort order must be ASC or DESC"),
];

const statsQueryValidation = [
  query("period")
    .optional()
    .isIn(["week", "month", "year"])
    .withMessage("Period must be one of: week, month, year"),
];

// Routes

// @route   GET /api/attendance
// @desc    Get all attendance records with filtering
// @access  Private (requires manage_attendance permission)
router.get(
  "/", 
  requirePermission("manage_attendance"), 
  queryValidation,
  attendanceController.getAttendanceRecords
);

// @route   GET /api/attendance/stats
// @desc    Get attendance statistics
// @access  Private (requires manage_attendance permission)
router.get(
  "/stats", 
  requirePermission("manage_attendance"), 
  statsQueryValidation,
  attendanceController.getAttendanceStats
);

// @route   GET /api/attendance/service-types
// @desc    Get available service types
// @access  Private (requires manage_attendance permission)
router.get(
  "/service-types",
  requirePermission("manage_attendance"),
  attendanceController.getServiceTypes
);

// @route   GET /api/attendance/members
// @desc    Get members for attendance tracking
// @access  Private (requires manage_attendance permission)
router.get(
  "/members", 
  requirePermission("manage_attendance"), 
  attendanceController.getMembersForAttendance
);

// @route   POST /api/attendance/report
// @desc    Generate attendance report (CSV or JSON)
// @access  Private (requires manage_attendance permission)
router.post(
  "/report", 
  requirePermission("manage_attendance"), 
  reportValidation,
  logActivity("generate_attendance_report"),
  attendanceController.generateReport
);

// @route   GET /api/attendance/:id
// @desc    Get attendance record by ID
// @access  Private (requires manage_attendance permission)
router.get(
  "/:id",
  requirePermission("manage_attendance"),
  attendanceIdValidation,
  attendanceController.getAttendanceById
);

// @route   POST /api/attendance
// @desc    Create new attendance record
// @access  Private (requires manage_attendance permission)
router.post(
  "/",
  requirePermission("manage_attendance"),
  createAttendanceValidation,
  logActivity("create_attendance"),
  attendanceController.createAttendance
);

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private (requires manage_attendance permission)
router.put(
  "/:id",
  requirePermission("manage_attendance"),
  updateAttendanceValidation,
  logActivity("update_attendance"),
  attendanceController.updateAttendance
);

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private (requires manage_attendance permission)
router.delete(
  "/:id",
  requirePermission("manage_attendance"),
  attendanceIdValidation,
  logActivity("delete_attendance"),
  attendanceController.deleteAttendance
);

module.exports = router;