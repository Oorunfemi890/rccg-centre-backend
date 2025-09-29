// controllers/publicController.js - FIXED: No direct model imports
const { Op } = require("sequelize");
const celebrationController = require("./celebrationsController");
const logger = require("../utils/logger");

class PublicController {
  // Health check for public endpoints
  async healthCheck(req, res) {
    res.json({
      success: true,
      message: "Public API is healthy",
      timestamp: new Date().toISOString(),
      endpoints: {
        celebrations: "/api/public/celebrations",
        celebrationTypes: "/api/public/celebration-types",
      },
    });
  }

  // Get available celebration types
  async getCelebrationTypes(req, res) {
    try {
      const celebrationTypes = [
        { value: "Birthday", label: "Birthday 🎂", emoji: "🎂" },
        {
          value: "Wedding Anniversary",
          label: "Wedding Anniversary 💍",
          emoji: "💍",
        },
        { value: "Baby Dedication", label: "Baby Dedication 👶", emoji: "👶" },
        { value: "Graduation", label: "Graduation 🎓", emoji: "🎓" },
        { value: "Promotion", label: "Career Promotion 💼", emoji: "💼" },
        { value: "New Job", label: "New Job 🎯", emoji: "🎯" },
        { value: "New Baby", label: "New Baby 🍼", emoji: "🍼" },
        {
          value: "House Dedication",
          label: "House Dedication 🏠",
          emoji: "🏠",
        },
        { value: "Other", label: "Other Celebration 🎉", emoji: "🎉" },
      ];

      res.json({
        success: true,
        data: celebrationTypes,
        message: "Celebration types retrieved successfully",
      });
    } catch (error) {
      logger.error("Get celebration types error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve celebration types",
      });
    }
  }

  // Submit celebration request
  async submitCelebration(req, res) {
    try {
      // Add additional logging for public submissions
      logger.info("Public celebration submission received", {
        type: req.body.type,
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        filesCount: req.files ? req.files.length : 0,
      });

      // Call the celebration controller method
      await celebrationController.submitCelebration(req, res);
    } catch (error) {
      logger.error("Public celebration submission error:", error);
      res.status(500).json({
        success: false,
        message:
          "We encountered an error processing your celebration request. Please try again or contact us directly.",
      });
    }
  }

  // Check celebration status by phone number
  async getCelebrationStatus(req, res) {
    try {
      // ✅ Get models from req.db
      const { Celebration } = req.db;

      const { phone } = req.params;

      const celebrations = await Celebration.findAll({
        where: {
          phone: phone,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        attributes: [
          "id",
          "type",
          "name",
          "status",
          "createdAt",
          "acknowledgedDate",
        ],
        order: [["createdAt", "DESC"]],
        limit: 5,
      });

      if (celebrations.length === 0) {
        return res.json({
          success: true,
          message: "No recent celebration requests found for this phone number",
          data: [],
        });
      }

      const statusData = celebrations.map((celebration) => ({
        id: celebration.id,
        type: celebration.type,
        name: celebration.name,
        status: celebration.status,
        submittedAt: celebration.createdAt,
        acknowledgedAt: celebration.acknowledgedDate,
        statusMessage: this.getStatusMessage(celebration.status),
      }));

      res.json({
        success: true,
        message: "Celebration status retrieved successfully",
        data: statusData,
      });
    } catch (error) {
      logger.error("Get celebration status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check celebration status",
      });
    }
  }

  // Contact form for celebration inquiries
  async submitContactInquiry(req, res) {
    try {
      const { name, email, phone, subject, message } = req.body;

      logger.info("Celebration contact form submission", {
        name,
        email,
        phone,
        subject,
        ip: req.ip,
      });

      // Here you would typically send an email to admins
      // await emailService.sendCelebrationInquiry({ name, email, phone, subject, message });

      res.json({
        success: true,
        message:
          "Thank you for your inquiry! We will get back to you within 24 hours.",
      });
    } catch (error) {
      logger.error("Contact celebration form error:", error);
      res.status(500).json({
        success: false,
        message:
          "Failed to send your inquiry. Please try again or contact us directly.",
      });
    }
  }

  // Helper method to get status message
  getStatusMessage(status) {
    switch (status) {
      case "pending":
        return "Your celebration request is being reviewed. We will contact you soon!";
      case "approved":
        return "Great news! Your celebration has been approved. We will acknowledge it during service.";
      case "rejected":
        return "We were unable to approve this celebration request. Please contact us for more information.";
      default:
        return "Status unknown. Please contact us for more information.";
    }
  }

  // Error handler for public routes
  handleError(error, req, res, next) {
    logger.error("Public route error:", {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });

    // Don't expose internal errors to public
    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred. Please try again or contact support.",
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = new PublicController();