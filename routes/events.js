// routes/events.js - Updated with controller separation
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const router = express.Router();

const eventsController = require("../controllers/eventsController");
const {
  authenticateToken,
  requirePermission,
  optionalAuth,
  logActivity,
} = require("../middleware/auth");

// Validation rules
const createEventValidation = [
  body("title")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters"),
  body("description")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Description must be at least 10 characters"),
  body("date")
    .isDate()
    .withMessage("Please provide a valid date")
    .custom((value) => {
      if (new Date(value) < new Date().setHours(0, 0, 0, 0)) {
        throw new Error("Event date cannot be in the past");
      }
      return true;
    }),
  body("time")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please provide a valid time in HH:MM format"),
  body("endTime")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please provide a valid end time in HH:MM format"),
  body("location").trim().notEmpty().withMessage("Location is required"),
  body("category")
    .isIn([
      "Service",
      "Conference",
      "Seminar",
      "Workshop",
      "Outreach",
      "Fellowship",
      "Youth Event",
      "Children Event",
      "Prayer Meeting",
      "Special Program",
      "Other",
    ])
    .withMessage("Please select a valid category"),
  body("maxAttendees")
    .optional()
    .isInt({ min: 1, max: 50000 })
    .withMessage("Max attendees must be between 1 and 50,000"),
  body("isRecurring")
    .optional()
    .isBoolean()
    .withMessage("isRecurring must be a boolean"),
  body("recurringPattern")
    .optional()
    .isIn(["daily", "weekly", "monthly", "yearly"])
    .withMessage("Invalid recurring pattern"),
  body("registrationRequired")
    .optional()
    .isBoolean()
    .withMessage("registrationRequired must be a boolean"),
  body("registrationDeadline")
    .optional()
    .isISO8601()
    .withMessage("Registration deadline must be a valid date"),
  body("eventFee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Event fee must be a non-negative number"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  body("image")
    .optional()
    .isString()
    .withMessage("Image must be a string URL"),
];

const updateEventValidation = [
  param("id").isUUID().withMessage("Invalid event ID"),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 10 })
    .withMessage("Description must be at least 10 characters"),
  body("date")
    .optional()
    .isDate()
    .withMessage("Please provide a valid date"),
  body("time")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please provide a valid time in HH:MM format"),
  body("endTime")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please provide a valid end time in HH:MM format"),
  body("location")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Location cannot be empty"),
  body("category")
    .optional()
    .isIn([
      "Service",
      "Conference",
      "Seminar",
      "Workshop",
      "Outreach",
      "Fellowship",
      "Youth Event",
      "Children Event",
      "Prayer Meeting",
      "Special Program",
      "Other",
    ])
    .withMessage("Please select a valid category"),
  body("maxAttendees")
    .optional()
    .isInt({ min: 1, max: 50000 })
    .withMessage("Max attendees must be between 1 and 50,000"),
  body("status")
    .optional()
    .isIn(["upcoming", "ongoing", "completed", "cancelled"])
    .withMessage("Invalid event status"),
  body("isRecurring")
    .optional()
    .isBoolean()
    .withMessage("isRecurring must be a boolean"),
  body("recurringPattern")
    .optional()
    .isIn(["daily", "weekly", "monthly", "yearly"])
    .withMessage("Invalid recurring pattern"),
  body("registrationRequired")
    .optional()
    .isBoolean()
    .withMessage("registrationRequired must be a boolean"),
  body("registrationDeadline")
    .optional()
    .isISO8601()
    .withMessage("Registration deadline must be a valid date"),
  body("eventFee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Event fee must be a non-negative number"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  body("image")
    .optional()
    .isString()
    .withMessage("Image must be a string URL"),
];

const eventIdValidation = [
  param("id").isUUID().withMessage("Invalid event ID"),
];

const attendanceValidation = [
  param("id").isUUID().withMessage("Invalid event ID"),
  body("attendanceCount")
    .isInt({ min: 0 })
    .withMessage("Attendance count must be a non-negative number"),
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
  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string"),
  query("status")
    .optional()
    .isString()
    .withMessage("Status must be a string"),
  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string"),
  query("upcoming")
    .optional()
    .isBoolean()
    .withMessage("Upcoming must be a boolean"),
  query("sortBy")
    .optional()
    .isIn(["date", "title", "category", "status", "createdAt"])
    .withMessage("Sort by must be one of: date, title, category, status, createdAt"),
  query("sortOrder")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Sort order must be ASC or DESC"),
];

const upcomingValidation = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
];

const exportValidation = [
  query("format")
    .optional()
    .isIn(["csv", "json"])
    .withMessage("Format must be either 'csv' or 'json'"),
  query("status")
    .optional()
    .isString()
    .withMessage("Status must be a string"),
  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string"),
];

// Routes

// @route   GET /api/events
// @desc    Get all events (public + private depending on auth)
// @access  Public/Private
router.get("/", optionalAuth, queryValidation, eventsController.getEvents);

// @route   GET /api/events/upcoming
// @desc    Get upcoming events (public endpoint for website)
// @access  Public
router.get("/upcoming", upcomingValidation, eventsController.getUpcomingEvents);

// @route   GET /api/events/categories
// @desc    Get event categories
// @access  Public
router.get("/categories", eventsController.getEventCategories);

// @route   GET /api/events/stats
// @desc    Get event statistics
// @access  Private (requires events permission)
router.get("/stats", authenticateToken, requirePermission("events"), eventsController.getEventsStats);

// @route   GET /api/events/export
// @desc    Export events to CSV or JSON
// @access  Private (requires events permission)
router.get("/export", authenticateToken, requirePermission("events"), exportValidation, logActivity("export_events"), eventsController.exportEvents);

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Public/Private
router.get("/:id", optionalAuth, eventIdValidation, eventsController.getEventById);

// @route   POST /api/events
// @desc    Create new event
// @access  Private (requires events permission)
router.post("/", authenticateToken, requirePermission("events"), createEventValidation, logActivity("create_event"), eventsController.createEvent);

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Private (requires events permission)
router.put("/:id", authenticateToken, requirePermission("events"), updateEventValidation, logActivity("update_event"), eventsController.updateEvent);

// @route   PATCH /api/events/:id/attendance
// @desc    Update event attendance count
// @access  Private (requires events permission)
router.patch("/:id/attendance", authenticateToken, requirePermission("events"), attendanceValidation, logActivity("update_event_attendance"), eventsController.updateEventAttendance);

// @route   POST /api/events/:id/duplicate
// @desc    Duplicate event
// @access  Private (requires events permission)
router.post("/:id/duplicate", authenticateToken, requirePermission("events"), eventIdValidation, logActivity("duplicate_event"), eventsController.duplicateEvent);

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Private (requires events permission)
router.delete("/:id", authenticateToken, requirePermission("events"), eventIdValidation, logActivity("delete_event"), eventsController.deleteEvent);

module.exports = router;