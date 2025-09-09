// routes/auth.js
const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const authController = require("../controllers/authController");
const {
  authenticateToken,
  authRateLimit,
  logActivity,
} = require("../middleware/auth");

// Validation rules
const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
];

const updateProfileValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("phone")
    .optional()
    .trim()
    .isLength({ min: 10, max: 15 })
    .withMessage("Please provide a valid phone number"),
  body("position")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Position must be less than 100 characters"),
];

const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
];

// Routes
router.post("/login", authRateLimit, loginValidation, authController.login);
router.post("/refresh", authController.refresh);
router.get("/verify", authenticateToken, authController.verify);
router.post("/logout", authenticateToken, logActivity("logout"), authController.logout);
router.put("/profile", authenticateToken, updateProfileValidation, logActivity("update_profile"), authController.updateProfile);
router.put("/change-password", authenticateToken, changePasswordValidation, logActivity("change_password"), authController.changePassword);
router.get("/me", authenticateToken, authController.getCurrentAdmin);
router.post("/forgot-password", authRateLimit, forgotPasswordValidation, authController.forgotPassword);

module.exports = router;