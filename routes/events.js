// routes/events.js
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { Op } = require("sequelize");
const router = express.Router();

const { Event, Admin } = require("../models");
const {
  authenticateToken,
  requirePermission,
  optionalAuth,
  logActivity,
} = require("../middleware/auth");
const logger = require("../utils/logger");
const { uploadMiddleware } = require("../middleware/upload");

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
    .isInt({ min: 1 })
    .withMessage("Max attendees must be a positive number"),
  body("isRecurring")
    .optional()
    .isBoolean()
    .withMessage("isRecurring must be a boolean"),
  body("recurringPattern")
    .optional()
    .isIn(["daily", "weekly", "monthly", "yearly"])
    .withMessage("Invalid recurring pattern"),
];

const updateEventValidation = [
  param("id").isUUID().withMessage("Invalid event ID"),
  ...createEventValidation,
];

const eventIdValidation = [
  param("id").isUUID().withMessage("Invalid event ID"),
];

// @route   GET /api/events
// @desc    Get all events (public + private depending on auth)
// @access  Public/Private
router.get("/", optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      category = "all",
      upcoming = false,
      sortBy = "date",
      sortOrder = "ASC",
    } = req.query;

    // Build where clause
    let whereClause = {};

    // For public access, only show upcoming events
    if (!req.admin) {
      whereClause.date = { [Op.gte]: new Date() };
      whereClause.status = "upcoming";
    } else {
      // Admin can see all events based on filters
      if (status !== "all") {
        whereClause.status = status;
      }

      if (upcoming === "true") {
        whereClause.date = { [Op.gte]: new Date() };
        whereClause.status = "upcoming";
      }
    }

    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Category filter
    if (category !== "all") {
      whereClause.category = category;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch events
    const { count, rows: events } = await Event.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: Admin,
          as: "organizer",
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
      message: "Events retrieved successfully",
      data: events,
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
    logger.error("Get events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve events",
    });
  }
});

// @route   GET /api/events/upcoming
// @desc    Get upcoming events (public endpoint for website)
// @access  Public
router.get("/upcoming", async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const events = await Event.getUpcomingEvents(parseInt(limit));

    res.json({
      success: true,
      message: "Upcoming events retrieved successfully",
      data: events,
    });
  } catch (error) {
    logger.error("Get upcoming events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve upcoming events",
    });
  }
});

// @route   GET /api/events/categories
// @desc    Get event categories
// @access  Public
router.get("/categories", async (req, res) => {
  try {
    const categories = [
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
    ];

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    logger.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
    });
  }
});

// @route   GET /api/events/stats
// @desc    Get event statistics
// @access  Private (requires events permission)
router.get(
  "/stats",
  authenticateToken,
  requirePermission("events"),
  async (req, res) => {
    try {
      const [
        totalEvents,
        upcomingEvents,
        completedEvents,
        thisMonthEvents,
        categoryStats,
        statusStats,
      ] = await Event.getStatistics();

      res.json({
        success: true,
        data: {
          totalEvents,
          upcomingEvents,
          completedEvents,
          thisMonthEvents,
          categoryStats,
          statusStats,
        },
      });
    } catch (error) {
      logger.error("Get event statistics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event statistics",
      });
    }
  }
);

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Public/Private
router.get("/:id", optionalAuth, eventIdValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const event = await Event.findByPk(req.params.id, {
      include: [
        {
          model: Admin,
          as: "organizer",
          attributes: ["name", "position"],
        },
      ],
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // For public access, only show upcoming events
    if (!req.admin && (event.status !== "upcoming" || event.isPast())) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.json({
      success: true,
      message: "Event retrieved successfully",
      data: event,
    });
  } catch (error) {
    logger.error("Get event error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve event",
    });
  }
});

// @route   POST /api/events
// @desc    Create new event
// @access  Private (requires events permission)
router.post(
  "/",
  authenticateToken,
  requirePermission("events"),
  uploadMiddleware.single("image"),
  createEventValidation,
  logActivity("create_event"),
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
        title,
        description,
        date,
        time,
        endTime,
        location,
        category,
        maxAttendees,
        isRecurring = false,
        recurringPattern,
        registrationRequired = false,
        registrationDeadline,
        eventFee = 0,
        tags = [],
      } = req.body;

      // Validate recurring pattern if event is recurring
      if (isRecurring && !recurringPattern) {
        return res.status(400).json({
          success: false,
          message: "Recurring pattern is required for recurring events",
        });
      }

      // Handle image upload
      let imageUrl = null;
      if (req.file) {
        imageUrl = req.file.path; // Cloudinary URL
      }

      // Create new event
      const newEvent = await Event.create({
        title,
        description,
        date,
        time,
        endTime,
        location,
        category,
        maxAttendees,
        isRecurring,
        recurringPattern,
        registrationRequired,
        registrationDeadline,
        eventFee,
        tags,
        image: imageUrl,
        organizerId: req.admin.id,
        status: "upcoming",
        currentAttendees: 0,
      });

      logger.info(
        `New event created: ${newEvent.title} (${newEvent.id}) by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("event-created", {
        event: {
          id: newEvent.id,
          title: newEvent.title,
          date: newEvent.date,
          time: newEvent.time,
        },
        createdBy: req.admin.name,
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Event created successfully",
        data: newEvent,
      });
    } catch (error) {
      logger.error("Create event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create event",
      });
    }
  }
);

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Private (requires events permission)
router.put(
  "/:id",
  authenticateToken,
  requirePermission("events"),
  uploadMiddleware.single("image"),
  updateEventValidation,
  logActivity("update_event"),
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

      const event = await Event.findByPk(req.params.id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      const {
        title,
        description,
        date,
        time,
        endTime,
        location,
        category,
        maxAttendees,
        isRecurring,
        recurringPattern,
        status,
        registrationRequired,
        registrationDeadline,
        eventFee,
        tags,
      } = req.body;

      // Handle image upload
      let imageUrl = event.image; // Keep existing image
      if (req.file) {
        imageUrl = req.file.path; // New image from Cloudinary
      }

      // Update event
      await event.update({
        title,
        description,
        date,
        time,
        endTime,
        location,
        category,
        maxAttendees,
        isRecurring,
        recurringPattern,
        status,
        registrationRequired,
        registrationDeadline,
        eventFee,
        tags,
        image: imageUrl,
      });

      logger.info(
        `Event updated: ${event.title} (${event.id}) by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("event-updated", {
        event: {
          id: event.id,
          title: event.title,
          date: event.date,
          time: event.time,
        },
        updatedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Event updated successfully",
        data: event,
      });
    } catch (error) {
      logger.error("Update event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update event",
      });
    }
  }
);

// @route   PATCH /api/events/:id/attendance
// @desc    Update event attendance count
// @access  Private (requires events permission)
router.patch(
  "/:id/attendance",
  authenticateToken,
  requirePermission("events"),
  eventIdValidation,
  [
    body("attendanceCount")
      .isInt({ min: 0 })
      .withMessage("Attendance count must be a non-negative number"),
  ],
  logActivity("update_event_attendance"),
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

      const event = await Event.findByPk(req.params.id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      const { attendanceCount } = req.body;

      // Check if attendance exceeds max attendees
      if (event.maxAttendees && attendanceCount > event.maxAttendees) {
        return res.status(400).json({
          success: false,
          message: "Attendance count cannot exceed maximum attendees",
        });
      }

      await event.update({ currentAttendees: attendanceCount });

      logger.info(
        `Event attendance updated: ${event.title} (${event.id}) - ${attendanceCount} attendees by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("event-attendance-updated", {
        event: {
          id: event.id,
          title: event.title,
          currentAttendees: attendanceCount,
        },
        updatedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Event attendance updated successfully",
        data: event,
      });
    } catch (error) {
      logger.error("Update event attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update event attendance",
      });
    }
  }
);

// @route   POST /api/events/:id/duplicate
// @desc    Duplicate event
// @access  Private (requires events permission)
router.post(
  "/:id/duplicate",
  authenticateToken,
  requirePermission("events"),
  eventIdValidation,
  logActivity("duplicate_event"),
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

      const originalEvent = await Event.findByPk(req.params.id);
      if (!originalEvent) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      // Create duplicated event with new date (next week)
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 7);

      const duplicatedEvent = await Event.create({
        title: `${originalEvent.title} (Copy)`,
        description: originalEvent.description,
        date: newDate.toISOString().split("T")[0],
        time: originalEvent.time,
        endTime: originalEvent.endTime,
        location: originalEvent.location,
        category: originalEvent.category,
        maxAttendees: originalEvent.maxAttendees,
        isRecurring: originalEvent.isRecurring,
        recurringPattern: originalEvent.recurringPattern,
        registrationRequired: originalEvent.registrationRequired,
        eventFee: originalEvent.eventFee,
        tags: originalEvent.tags,
        image: originalEvent.image,
        organizerId: req.admin.id,
        status: "upcoming",
        currentAttendees: 0,
      });

      logger.info(
        `Event duplicated: ${duplicatedEvent.title} (${duplicatedEvent.id}) from ${originalEvent.title} by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("event-duplicated", {
        originalEvent: {
          id: originalEvent.id,
          title: originalEvent.title,
        },
        newEvent: {
          id: duplicatedEvent.id,
          title: duplicatedEvent.title,
          date: duplicatedEvent.date,
        },
        duplicatedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Event duplicated successfully",
        data: duplicatedEvent,
      });
    } catch (error) {
      logger.error("Duplicate event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to duplicate event",
      });
    }
  }
);

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Private (requires events permission)
router.delete(
  "/:id",
  authenticateToken,
  requirePermission("events"),
  eventIdValidation,
  logActivity("delete_event"),
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

      const event = await Event.findByPk(req.params.id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      const eventTitle = event.title;
      const eventId = event.id;

      await event.destroy();

      logger.info(
        `Event deleted: ${eventTitle} (${eventId}) by ${req.admin.name}`
      );

      // Emit real-time notification
      const io = req.app.get("io");
      io.to("admin-room").emit("event-deleted", {
        event: {
          id: eventId,
          title: eventTitle,
        },
        deletedBy: req.admin.name,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error) {
      logger.error("Delete event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete event",
      });
    }
  }
);

// @route   GET /api/events/export
// @desc    Export events to CSV
// @access  Private (requires events permission)
router.get(
  "/export",
  authenticateToken,
  requirePermission("events"),
  async (req, res) => {
    try {
      const { format = "csv", status = "all", category = "all" } = req.query;

      // Build where clause
      let whereClause = {};
      if (status !== "all") {
        whereClause.status = status;
      }
      if (category !== "all") {
        whereClause.category = category;
      }

      const events = await Event.findAll({
        where: whereClause,
        include: [
          {
            model: Admin,
            as: "organizer",
            attributes: ["name"],
          },
        ],
        order: [["date", "ASC"]],
      });

      if (format === "csv") {
        // Generate CSV content
        const csvHeaders =
          "Title,Description,Date,Time,End Time,Location,Category,Status,Organizer,Max Attendees,Current Attendees,Registration Required,Event Fee\n";
        const csvContent = events
          .map((event) =>
            [
              `"${event.title}"`,
              `"${event.description}"`,
              event.date,
              event.time,
              event.endTime || "",
              `"${event.location}"`,
              event.category,
              event.status,
              `"${event.organizer?.name || ""}"`,
              event.maxAttendees || "No Limit",
              event.currentAttendees || 0,
              event.registrationRequired ? "Yes" : "No",
              event.eventFee || 0,
            ].join(",")
          )
          .join("\n");

        const fullCsv = csvHeaders + csvContent;

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="events_export_${
            new Date().toISOString().split("T")[0]
          }.csv"`
        );
        res.send(fullCsv);
      } else {
        res.json({
          success: true,
          data: events,
          count: events.length,
        });
      }
    } catch (error) {
      logger.error("Export events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export events",
      });
    }
  }
);

module.exports = router;
