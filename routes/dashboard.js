// routes/dashboard.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get("/stats", dashboardController.getStats);

// @route   GET /api/dashboard/recent-activities
// @desc    Get recent activities
// @access  Private
router.get("/recent-activities", dashboardController.getRecentActivities);

// @route   GET /api/dashboard/upcoming-events
// @desc    Get upcoming events
// @access  Private
router.get("/upcoming-events", dashboardController.getUpcomingEvents);

// @route   GET /api/dashboard/attendance-summary
// @desc    Get attendance summary
// @access  Private
router.get("/attendance-summary", dashboardController.getAttendanceSummary);

// @route   GET /api/dashboard/member-growth
// @desc    Get member growth data
// @access  Private
router.get("/member-growth", dashboardController.getMemberGrowth);

// @route   GET /api/dashboard/quick-stats
// @desc    Get quick stats for header/summary
// @access  Private
router.get("/quick-stats", dashboardController.getQuickStats);

// @route   GET /api/dashboard/chart-data
// @desc    Get chart data for dashboard visualizations
// @access  Private
router.get("/chart-data", dashboardController.getChartData);

module.exports = router;