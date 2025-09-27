// routes/members.js
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const router = express.Router();

const membersController = require("../controllers/membersController");
const { requirePermission, logActivity } = require("../middleware/auth");

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

const searchValidation = [
  query("q").notEmpty().withMessage("Search query is required"),
];

const statusUpdateValidation = [
  body("isActive")
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// MEMBER ROUTES

// @route   GET /api/members
// @desc    Get all members with filtering and pagination
// @access  Private (requires members permission)
router.get(
  "/",
  requirePermission("members"),
  membersController.getAllMembers
);

// @route   GET /api/members/stats
// @desc    Get member statistics
// @access  Private (requires members permission)
router.get(
  "/stats",
  requirePermission("members"),
  membersController.getMemberStats
);

// @route   GET /api/members/departments
// @desc    Get list of departments
// @access  Private (requires members permission)
router.get(
  "/departments",
  requirePermission("members"),
  membersController.getDepartments
);

// @route   GET /api/members/search
// @desc    Search members
// @access  Private (requires members permission)
router.get(
  "/search",
  requirePermission("members"),
  searchValidation,
  handleValidationErrors,
  membersController.searchMembers
);

// @route   GET /api/members/export
// @desc    Export members to CSV
// @access  Private (requires members permission)
router.get(
  "/export",
  requirePermission("members"),
  membersController.exportMembers
);

// @route   GET /api/members/:id
// @desc    Get member by ID
// @access  Private (requires members permission)
router.get(
  "/:id",
  requirePermission("members"),
  memberIdValidation,
  handleValidationErrors,
  membersController.getMemberById
);

// @route   POST /api/members
// @desc    Create new member
// @access  Private (requires members permission)
router.post(
  "/",
  requirePermission("members"),
  createMemberValidation,
  handleValidationErrors,
  logActivity("create_member"),
  membersController.createMember
);

// @route   PUT /api/members/:id
// @desc    Update member
// @access  Private (requires members permission)
router.put(
  "/:id",
  requirePermission("members"),
  updateMemberValidation,
  handleValidationErrors,
  logActivity("update_member"),
  membersController.updateMember
);

// @route   PATCH /api/members/:id/status
// @desc    Update member status (active/inactive)
// @access  Private (requires members permission)
router.patch(
  "/:id/status",
  requirePermission("members"),
  memberIdValidation,
  statusUpdateValidation,
  handleValidationErrors,
  logActivity("update_member_status"),
  membersController.updateMemberStatus
);

// @route   DELETE /api/members/:id
// @desc    Soft delete member (set inactive)
// @access  Private (requires members permission)
router.delete(
  "/:id",
  requirePermission("members"),
  memberIdValidation,
  handleValidationErrors,
  logActivity("delete_member"),
  membersController.deleteMember
);

module.exports = router;