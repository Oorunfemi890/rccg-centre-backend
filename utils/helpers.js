// utils/helpers.js
const crypto = require('crypto');

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the random string
 * @returns {string} - Random string
 */
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Format phone number to international format
 * @param {string} phone - Phone number
 * @param {string} countryCode - Country code (default: +234 for Nigeria)
 * @returns {string} - Formatted phone number
 */
const formatPhoneNumber = (phone, countryCode = '+234') => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // If starts with country code digits, add + sign
  if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
    return '+' + cleanPhone;
  }
  
  // If starts with 0, replace with country code
  if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
    return countryCode + ' ' + cleanPhone.substring(1);
  }
  
  // If just the mobile part
  if (cleanPhone.length === 10) {
    return countryCode + ' ' + cleanPhone;
  }
  
  return phone; // Return as is if format is unclear
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} - True if valid email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Calculate age from date of birth
 * @param {Date|string} dateOfBirth - Date of birth
 * @returns {number} - Age in years
 */
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Generate pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} totalCount - Total number of items
 * @returns {object} - Pagination metadata
 */
const generatePaginationMeta = (page, limit, totalCount) => {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    currentPage: parseInt(page),
    totalPages,
    totalRecords: totalCount,
    hasNextPage,
    hasPrevPage,
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  };
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale for formatting (default: en-US)
 * @returns {string} - Formatted date
 */
const formatDate = (date, locale = 'en-US') => {
  if (!date) return '';
  
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format time for display
 * @param {string} time - Time in HH:MM format
 * @returns {string} - Formatted time (12-hour format)
 */
const formatTime = (time) => {
  if (!time) return '';
  
  const [hours, minutes] = time.split(':');
  const hour12 = ((parseInt(hours) + 11) % 12) + 1;
  const amPm = parseInt(hours) >= 12 ? 'PM' : 'AM';
  
  return `${hour12}:${minutes} ${amPm}`;
};

/**
 * Sanitize string for safe database storage
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

/**
 * Generate slug from title
 * @param {string} title - Title to convert to slug
 * @returns {string} - URL-friendly slug
 */
const generateSlug = (title) => {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is today
 */
const isToday = (date) => {
  if (!date) return false;
  
  const today = new Date();
  const checkDate = new Date(date);
  
  return today.getDate() === checkDate.getDate() &&
         today.getMonth() === checkDate.getMonth() &&
         today.getFullYear() === checkDate.getFullYear();
};

/**
 * Get days until date
 * @param {Date|string} date - Target date
 * @returns {number} - Days until date (negative if past)
 */
const getDaysUntil = (date) => {
  if (!date) return null;
  
  const today = new Date();
  const targetDate = new Date(date);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: NGN)
 * @returns {string} - Formatted currency
 */
const formatCurrency = (amount, currency = 'NGN') => {
  if (!amount && amount !== 0) return '';
  
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Validate Nigerian phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid Nigerian phone number
 */
const isValidNigerianPhone = (phone) => {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Check various Nigerian phone formats
  const patterns = [
    /^234[789][01]\d{8}$/, // +234 format
    /^[789][01]\d{8}$/, // Local format without 0
    /^0[789][01]\d{8}$/ // Local format with 0
  ];
  
  return patterns.some(pattern => pattern.test(cleanPhone));
};

/**
 * Generate initials from name
 * @param {string} name - Full name
 * @returns {string} - Initials (max 2 characters)
 */
const getInitials = (name) => {
  if (!name) return '';
  
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

/**
 * Check if string contains only letters and spaces
 * @param {string} str - String to check
 * @returns {boolean} - True if only letters and spaces
 */
const isAlphaSpace = (str) => {
  if (!str) return false;
  return /^[A-Za-z\s]+$/.test(str);
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated
 * @returns {string} - Truncated text
 */
const truncateText = (text, maxLength = 100, suffix = '...') => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength).trim() + suffix;
};

/**
 * Deep clone object
 * @param {object} obj - Object to clone
 * @returns {object} - Cloned object
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(deepClone);
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
const escapeHtml = (text) => {
  if (!text) return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

module.exports = {
  generateRandomString,
  formatPhoneNumber,
  isValidEmail,
  calculateAge,
  generatePaginationMeta,
  formatDate,
  formatTime,
  sanitizeString,
  generateSlug,
  isToday,
  getDaysUntil,
  formatCurrency,
  isValidNigerianPhone,
  getInitials,
  isAlphaSpace,
  truncateText,
  deepClone,
  escapeHtml
};