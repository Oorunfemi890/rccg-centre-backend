// routes/dashboard.js
const express = require("express");
const { Op } = require("sequelize");
const router = express.Router();

const { Member, Event, Attendance, Celebration, Admin } = require("../models");
const logger = require("../utils/logger");

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get("/stats", async (req, res) => {
  try {
    // Get basic counts
    const [
      totalMembers,
      activeMembers,
      totalEvents,
      upcomingEvents,
      pendingCelebrations,
      thisWeekAttendance,
      thisMonthAttendance,
    ] = await Promise.all([
      Member.count(),
      Member.count({ where: { isActive: true } }),
      Event.count(),
      Event.count({
        where: {
          date: { [Op.gte]: new Date() },
          status: "upcoming",
        },
      }),
      Celebration.count({ where: { status: "pending" } }),
      getThisWeekAttendance(),
      getThisMonthAverageAttendance(),
    ]);

    res.json({
      success: true,
      data: {
        totalMembers,
        activeMembers,
        totalEvents,
        upcomingEvents,
        pendingCelebrations,
        thisWeekAttendance,
        thisMonthAttendance,
      },
    });
  } catch (error) {
    logger.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard statistics",
    });
  }
});

// @route   GET /api/dashboard/recent-activities
// @desc    Get recent activities
// @access  Private
router.get("/recent-activities", async (req, res) => {
  try {
    const activities = [];

    // Get recent members (last 7 days)
    const recentMembers = await Member.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      order: [["createdAt", "DESC"]],
      limit: 3,
      attributes: ["name", "createdAt"],
    });

    recentMembers.forEach((member) => {
      activities.push({
        description: `New member ${member.name} joined`,
        icon: "ri-user-add-line",
        iconBg: "bg-green-100 text-green-600",
        createdAt: member.createdAt,
      });
    });

    // Get recent attendance records (last 7 days)
    const recentAttendance = await Attendance.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      order: [["createdAt", "DESC"]],
      limit: 3,
      attributes: ["serviceType", "totalAttendance", "createdAt"],
    });

    recentAttendance.forEach((attendance) => {
      activities.push({
        description: `${attendance.serviceType} attendance recorded (${attendance.totalAttendance} people)`,
        icon: "ri-calendar-check-line",
        iconBg: "bg-blue-100 text-blue-600",
        createdAt: attendance.createdAt,
      });
    });

    // Get recent events (last 7 days)
    const recentEvents = await Event.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      order: [["createdAt", "DESC"]],
      limit: 3,
      attributes: ["title", "createdAt"],
    });

    recentEvents.forEach((event) => {
      activities.push({
        description: `${event.title} event created`,
        icon: "ri-calendar-event-line",
        iconBg: "bg-purple-100 text-purple-600",
        createdAt: event.createdAt,
      });
    });

    // Get recent celebration approvals (last 7 days)
    const recentCelebrations = await Celebration.findAll({
      where: {
        status: "approved",
        updatedAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      order: [["updatedAt", "DESC"]],
      limit: 3,
      attributes: ["name", "type", "updatedAt"],
    });

    recentCelebrations.forEach((celebration) => {
      activities.push({
        description: `${celebration.type} celebration approved for ${celebration.name}`,
        icon: "ri-cake-3-line",
        iconBg: "bg-yellow-100 text-yellow-600",
        createdAt: celebration.updatedAt,
      });
    });

    // Sort all activities by date and limit to 10
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const limitedActivities = activities.slice(0, 10);

    res.json({
      success: true,
      data: limitedActivities,
    });
  } catch (error) {
    logger.error("Get recent activities error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve recent activities",
    });
  }
});

// @route   GET /api/dashboard/upcoming-events
// @desc    Get upcoming events
// @access  Private
router.get("/upcoming-events", async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const upcomingEvents = await Event.findAll({
      where: {
        date: { [Op.gte]: new Date() },
        status: "upcoming",
      },
      order: [
        ["date", "ASC"],
        ["time", "ASC"],
      ],
      limit: parseInt(limit),
      include: [
        {
          model: Admin,
          as: "organizer",
          attributes: ["name", "position"],
        },
      ],
    });

    res.json({
      success: true,
      data: upcomingEvents,
    });
  } catch (error) {
    logger.error("Get upcoming events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve upcoming events",
    });
  }
});

// @route   GET /api/dashboard/attendance-summary
// @desc    Get attendance summary
// @access  Private
router.get("/attendance-summary", async (req, res) => {
  try {
    const { period = "week" } = req.query;

    let startDate;
    const now = new Date();

    switch (period) {
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    const attendanceData = await Attendance.findAll({
      where: {
        date: { [Op.gte]: startDate },
      },
      order: [["date", "ASC"]],
      attributes: ["date", "totalAttendance", "visitors", "serviceType"],
    });

    const summary = {
      period,
      total: attendanceData.reduce((sum, a) => sum + a.totalAttendance, 0),
      average:
        attendanceData.length > 0
          ? Math.round(
              attendanceData.reduce((sum, a) => sum + a.totalAttendance, 0) /
                attendanceData.length
            )
          : 0,
      data: attendanceData.map((a) => ({
        date: a.date,
        total: a.totalAttendance,
        visitors: a.visitors,
        members: a.totalAttendance - a.visitors,
        serviceType: a.serviceType,
      })),
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error("Get attendance summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve attendance summary",
    });
  }
});

// @route   GET /api/dashboard/member-growth
// @desc    Get member growth data
// @access  Private
router.get("/member-growth", async (req, res) => {
  try {
    const { period = "year" } = req.query;

    // Get member growth data for the last 12 months
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      // Get total members up to this date
      const totalMembers = await Member.count({
        where: {
          membershipDate: { [Op.lt]: nextDate },
        },
      });

      // Get new members this month
      const newMembers = await Member.count({
        where: {
          membershipDate: {
            [Op.gte]: date,
            [Op.lt]: nextDate,
          },
        },
      });

      months.push({
        month: date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        members: totalMembers,
        newMembers: newMembers,
      });
    }

    const totalGrowth =
      months.length > 1
        ? months[months.length - 1].members - months[0].members
        : 0;
    const growthRate =
      months[0].members > 0
        ? ((totalGrowth / months[0].members) * 100).toFixed(1)
        : "0.0";

    res.json({
      success: true,
      data: {
        period,
        totalGrowth,
        growthRate: parseFloat(growthRate),
        data: months,
      },
    });
  } catch (error) {
    logger.error("Get member growth error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve member growth data",
    });
  }
});

// Helper functions
async function getThisWeekAttendance() {
  try {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weeklyAttendance = await Attendance.findAll({
      where: {
        date: {
          [Op.between]: [startOfWeek, endOfWeek],
        },
      },
      attributes: ["totalAttendance"],
    });

    return weeklyAttendance.reduce(
      (sum, record) => sum + record.totalAttendance,
      0
    );
  } catch (error) {
    logger.error("Get this week attendance error:", error);
    return 0;
  }
}

async function getThisMonthAverageAttendance() {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyAttendance = await Attendance.findAll({
      where: {
        date: { [Op.gte]: startOfMonth },
      },
      attributes: ["totalAttendance"],
    });

    if (monthlyAttendance.length === 0) return 0;

    const total = monthlyAttendance.reduce(
      (sum, record) => sum + record.totalAttendance,
      0
    );
    return Math.round(total / monthlyAttendance.length);
  } catch (error) {
    logger.error("Get this month average attendance error:", error);
    return 0;
  }
}

module.exports = router;
