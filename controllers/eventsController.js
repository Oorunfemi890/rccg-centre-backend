// controllers/eventsController.js
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const { Event, Admin } = require("../models");
const logger = require("../utils/logger");

const eventsController = {
  // @desc    Get all events (public + private depending on auth)
  // @route   GET /api/events
  // @access  Public/Private
  getEvents: async (req, res) => {
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
            attributes: ["id", "name", "position"],
          },
        ],
      });

      // Calculate pagination info
      const totalPages = Math.ceil(count / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      // Format the data for frontend
      const formattedEvents = events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        endTime: event.endTime,
        location: event.location,
        category: event.category,
        maxAttendees: event.maxAttendees,
        currentAttendees: event.currentAttendees,
        isRecurring: event.isRecurring,
        recurringPattern: event.recurringPattern,
        status: event.status,
        image: event.image,
        organizer: event.organizer?.name || 'Unknown',
        organizerId: event.organizerId,
        registrationRequired: event.registrationRequired,
        registrationDeadline: event.registrationDeadline,
        eventFee: event.eventFee,
        tags: event.tags,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
      }));

      res.json({
        success: true,
        message: "Events retrieved successfully",
        data: formattedEvents,
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
  },

  // @desc    Get upcoming events (public endpoint for website)
  // @route   GET /api/events/upcoming
  // @access  Public
  getUpcomingEvents: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const events = await Event.getUpcomingEvents(parseInt(limit));

      const formattedEvents = events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        endTime: event.endTime,
        location: event.location,
        category: event.category,
        maxAttendees: event.maxAttendees,
        currentAttendees: event.currentAttendees,
        status: event.status,
        image: event.image,
        organizer: event.organizer?.name || 'Unknown'
      }));

      res.json({
        success: true,
        message: "Upcoming events retrieved successfully",
        data: formattedEvents,
      });
    } catch (error) {
      logger.error("Get upcoming events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve upcoming events",
      });
    }
  },

  // @desc    Get event categories
  // @route   GET /api/events/categories
  // @access  Public
  getEventCategories: async (req, res) => {
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
        message: "Event categories retrieved successfully",
        data: categories,
      });
    } catch (error) {
      logger.error("Get categories error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve categories",
      });
    }
  },

  // @desc    Get event statistics
  // @route   GET /api/events/stats
  // @access  Private
  getEventsStats: async (req, res) => {
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
        message: "Event statistics retrieved successfully",
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
  },

  // @desc    Get event by ID
  // @route   GET /api/events/:id
  // @access  Public/Private
  getEventById: async (req, res) => {
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
            attributes: ["id", "name", "position"],
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

      // Format the data for frontend
      const formattedEvent = {
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        endTime: event.endTime,
        location: event.location,
        category: event.category,
        maxAttendees: event.maxAttendees,
        currentAttendees: event.currentAttendees,
        isRecurring: event.isRecurring,
        recurringPattern: event.recurringPattern,
        status: event.status,
        image: event.image,
        organizer: event.organizer?.name || 'Unknown',
        organizerId: event.organizerId,
        registrationRequired: event.registrationRequired,
        registrationDeadline: event.registrationDeadline,
        eventFee: event.eventFee,
        tags: event.tags,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
      };

      res.json({
        success: true,
        message: "Event retrieved successfully",
        data: formattedEvent,
      });
    } catch (error) {
      logger.error("Get event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event",
      });
    }
  },

  // @desc    Create new event
  // @route   POST /api/events
  // @access  Private
  createEvent: async (req, res) => {
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
        image
      } = req.body;

      // Validate recurring pattern if event is recurring
      if (isRecurring && !recurringPattern) {
        return res.status(400).json({
          success: false,
          message: "Recurring pattern is required for recurring events",
        });
      }

      // Handle image - in production, you would upload to cloud storage
      let imageUrl = null;
      if (req.file) {
        imageUrl = req.file.path; // Cloudinary URL
      } else if (image) {
        // For frontend compatibility, accept image as string
        imageUrl = image;
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
      if (io) {
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
      }

      // Fetch the created event with includes for response
      const createdEvent = await Event.findByPk(newEvent.id, {
        include: [
          {
            model: Admin,
            as: "organizer",
            attributes: ["id", "name", "position"],
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: "Event created successfully",
        data: {
          id: createdEvent.id,
          title: createdEvent.title,
          description: createdEvent.description,
          date: createdEvent.date,
          time: createdEvent.time,
          endTime: createdEvent.endTime,
          location: createdEvent.location,
          category: createdEvent.category,
          maxAttendees: createdEvent.maxAttendees,
          currentAttendees: createdEvent.currentAttendees,
          isRecurring: createdEvent.isRecurring,
          recurringPattern: createdEvent.recurringPattern,
          status: createdEvent.status,
          image: createdEvent.image,
          organizer: createdEvent.organizer?.name,
          createdAt: createdEvent.createdAt,
        },
      });
    } catch (error) {
      logger.error("Create event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create event",
      });
    }
  },

  // @desc    Update event
  // @route   PUT /api/events/:id
  // @access  Private
  updateEvent: async (req, res) => {
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
        image
      } = req.body;

      // Handle image upload
      let imageUrl = event.image; // Keep existing image
      if (req.file) {
        imageUrl = req.file.path; // New image from Cloudinary
      } else if (image && image !== event.image) {
        imageUrl = image; // Updated image URL from frontend
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
      if (io) {
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
      }

      // Fetch updated event with includes
      const updatedEvent = await Event.findByPk(event.id, {
        include: [
          {
            model: Admin,
            as: "organizer",
            attributes: ["id", "name", "position"],
          },
        ],
      });

      res.json({
        success: true,
        message: "Event updated successfully",
        data: {
          id: updatedEvent.id,
          title: updatedEvent.title,
          description: updatedEvent.description,
          date: updatedEvent.date,
          time: updatedEvent.time,
          endTime: updatedEvent.endTime,
          location: updatedEvent.location,
          category: updatedEvent.category,
          maxAttendees: updatedEvent.maxAttendees,
          currentAttendees: updatedEvent.currentAttendees,
          isRecurring: updatedEvent.isRecurring,
          recurringPattern: updatedEvent.recurringPattern,
          status: updatedEvent.status,
          image: updatedEvent.image,
          organizer: updatedEvent.organizer?.name,
          updatedAt: updatedEvent.updatedAt,
        },
      });
    } catch (error) {
      logger.error("Update event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update event",
      });
    }
  },

  // @desc    Update event attendance count
  // @route   PATCH /api/events/:id/attendance
  // @access  Private
  updateEventAttendance: async (req, res) => {
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
      if (io) {
        io.to("admin-room").emit("event-attendance-updated", {
          event: {
            id: event.id,
            title: event.title,
            currentAttendees: attendanceCount,
          },
          updatedBy: req.admin.name,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Event attendance updated successfully",
        data: {
          id: event.id,
          title: event.title,
          currentAttendees: event.currentAttendees,
          maxAttendees: event.maxAttendees,
        },
      });
    } catch (error) {
      logger.error("Update event attendance error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update event attendance",
      });
    }
  },

  // @desc    Duplicate event
  // @route   POST /api/events/:id/duplicate
  // @access  Private
  duplicateEvent: async (req, res) => {
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
      if (io) {
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
      }

      res.status(201).json({
        success: true,
        message: "Event duplicated successfully",
        data: {
          id: duplicatedEvent.id,
          title: duplicatedEvent.title,
          description: duplicatedEvent.description,
          date: duplicatedEvent.date,
          time: duplicatedEvent.time,
          location: duplicatedEvent.location,
          category: duplicatedEvent.category,
          status: duplicatedEvent.status,
        },
      });
    } catch (error) {
      logger.error("Duplicate event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to duplicate event",
      });
    }
  },

  // @desc    Delete event
  // @route   DELETE /api/events/:id
  // @access  Private
  deleteEvent: async (req, res) => {
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
      if (io) {
        io.to("admin-room").emit("event-deleted", {
          event: {
            id: eventId,
            title: eventTitle,
          },
          deletedBy: req.admin.name,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Event deleted successfully",
        data: { id: eventId },
      });
    } catch (error) {
      logger.error("Delete event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete event",
      });
    }
  },

  // @desc    Export events to CSV
  // @route   GET /api/events/export
  // @access  Private
  exportEvents: async (req, res) => {
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
          message: "Events exported successfully",
          data: events.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            date: event.date,
            time: event.time,
            endTime: event.endTime,
            location: event.location,
            category: event.category,
            status: event.status,
            organizer: event.organizer?.name || "Unknown",
            maxAttendees: event.maxAttendees,
            currentAttendees: event.currentAttendees,
            registrationRequired: event.registrationRequired,
            eventFee: event.eventFee,
            createdAt: event.createdAt,
          })),
          count: events.length,
        });
      }

      logger.info(`Events exported by ${req.admin.name} - Format: ${format}, Records: ${events.length}`);

    } catch (error) {
      logger.error("Export events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export events",
      });
    }
  },
};

module.exports = eventsController;