// routes/auth.js - Enhanced with profile update endpoints
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
  body("token")
    .notEmpty()
    .withMessage("Verification token is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
];

const requestPasswordChangeValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
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
  body("token")
    .optional()
    .isString()
    .withMessage("Token must be a string"),
];

const requestProfileUpdateValidation = [
  body("type")
    .isIn(['email', 'profile'])
    .withMessage("Type must be either 'email' or 'profile'"),
];

const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
];

const verifyTokenValidation = [
  body("token")
    .notEmpty()
    .withMessage("Verification token is required"),
];

// Authentication Routes
router.post("/login", authRateLimit, loginValidation, authController.login);
router.post("/refresh", authController.refresh);
router.get("/verify", authenticateToken, authController.verify);
router.post("/logout", authenticateToken, logActivity("logout"), authController.logout);

// Profile Management Routes
router.get("/me", authenticateToken, authController.getCurrentAdmin);
router.post("/request-profile-update", authenticateToken, requestProfileUpdateValidation, logActivity("request_profile_update"), authController.requestProfileUpdate);
router.put("/profile", authenticateToken, updateProfileValidation, logActivity("update_profile"), authController.updateProfile);
router.post("/verify-profile-token", authenticateToken, verifyTokenValidation, authController.verifyProfileToken);

// Password Management Routes
router.post("/request-password-change", authenticateToken, requestPasswordChangeValidation, logActivity("request_password_change"), authController.requestPasswordChange);
router.put("/change-password", authenticateToken, changePasswordValidation, logActivity("change_password"), authController.changePassword);
router.post("/verify-password-token", authenticateToken, verifyTokenValidation, authController.verifyPasswordToken);

// Password Reset Routes (Public)
router.post("/forgot-password", authRateLimit, forgotPasswordValidation, authController.forgotPassword);

module.exports = router;