const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');
const AppError = require('../utils/AppError');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Without Cloudinary (local development) photos are saved here and served at /api/uploads
const UPLOADS_DIR = require('../utils/uploadsDir');
const LOCAL_PREFIX = 'local/';

// SVG and other image types are refused: served from our own origin they could carry scripts
const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const TYPE_ERROR = 'Only JPG, PNG or WEBP images are allowed';

// Use memory storage — files are held in buffer before upload to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(TYPE_ERROR), false);
    }
  },
});

/**
 * Wrap multer middleware to return a clean JSON 400 on file-size / type errors
 * instead of letting them bubble up as unhandled 500s.
 */
const handleUploadErrors = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'fail',
        message: 'Image too large. Maximum allowed size is 10 MB per file.',
      });
    }
    if (err.message === TYPE_ERROR) {
      return res.status(400).json({ status: 'fail', message: err.message });
    }
    next(err);
  });
};

/**
 * Upload a buffer to Cloudinary using upload_stream (compatible with v2).
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {object} options - Cloudinary upload options
 * @returns {Promise<object>} Cloudinary upload result
 */
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: 'aneighar/pg-images',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    Readable.from(buffer).pipe(stream);
  });
};

/** Save one multer file to Cloudinary, or to local disk when Cloudinary isn't set up. */
const storeImage = async (file) => {
  if (isCloudinaryConfigured()) {
    const result = await uploadToCloudinary(file.buffer, { resource_type: 'image' });
    return { url: result.secure_url, publicId: result.public_id };
  }
  if (process.env.NODE_ENV === 'production') {
    // Serverless hosts don't keep files on disk — refuse rather than silently lose photos
    throw new AppError('Photo uploads aren’t set up on the server yet.', 503);
  }

  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  const name = `${crypto.randomBytes(12).toString('hex')}${ALLOWED_TYPES[file.mimetype]}`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, name), file.buffer);
  return { url: `/api/uploads/${name}`, publicId: `${LOCAL_PREFIX}${name}` };
};

/** Delete a photo saved by storeImage. */
const deleteStoredImage = async (publicId) => {
  if (publicId.startsWith(LOCAL_PREFIX)) {
    // basename() keeps the delete inside UPLOADS_DIR whatever the id contains
    const name = path.basename(publicId.slice(LOCAL_PREFIX.length));
    await fs.promises.unlink(path.join(UPLOADS_DIR, name)).catch(() => {});
    return;
  }
  if (isCloudinaryConfigured()) await cloudinary.uploader.destroy(publicId);
};

module.exports = {
  cloudinary,
  upload,
  handleUploadErrors,
  uploadToCloudinary,
  storeImage,
  deleteStoredImage,
};
