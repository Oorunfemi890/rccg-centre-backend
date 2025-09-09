// middleware/upload.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'church-admin',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 800, height: 600, crop: 'limit', quality: 'auto' }
    ],
    public_id: (req, file) => {
      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `${file.fieldname}-${uniqueSuffix}`;
    }
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 5 // Maximum 5 files
  }
});

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed.'
    });
  }
  
  logger.error('Upload error:', error);
  return res.status(500).json({
    success: false,
    message: 'File upload failed.'
  });
};

// Export configured upload middleware
const uploadMiddleware = {
  single: (fieldName) => (req, res, next) => {
    upload.single(fieldName)(req, res, (error) => {
      if (error) {
        return handleUploadError(error, req, res, next);
      }
      next();
    });
  },
  
  multiple: (fieldName, maxCount = 5) => (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (error) => {
      if (error) {
        return handleUploadError(error, req, res, next);
      }
      next();
    });
  },
  
  fields: (fields) => (req, res, next) => {
    upload.fields(fields)(req, res, (error) => {
      if (error) {
        return handleUploadError(error, req, res, next);
      }
      next();
    });
  }
};

module.exports = { uploadMiddleware };