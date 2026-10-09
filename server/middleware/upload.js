const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');
const ImageFile = require('../models/ImageFile');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Without Cloudinary, photos are kept in MongoDB and served at /api/uploads/:id
const DB_PREFIX = 'db/';

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

/**
 * Save one multer file to Cloudinary, or to MongoDB when Cloudinary isn't set up.
 * (Serverless hosts like Vercel don't keep files on disk, so the database is the fallback.)
 */
const storeImage = async (file) => {
  if (isCloudinaryConfigured()) {
    const result = await uploadToCloudinary(file.buffer, { resource_type: 'image' });
    return { url: result.secure_url, publicId: result.public_id };
  }

  const doc = await ImageFile.create({ data: file.buffer, contentType: file.mimetype, size: file.size });
  return { url: `/api/uploads/${doc._id}`, publicId: `${DB_PREFIX}${doc._id}` };
};

/** Delete a photo saved by storeImage. */
const deleteStoredImage = async (publicId) => {
  if (publicId.startsWith(DB_PREFIX)) {
    const id = publicId.slice(DB_PREFIX.length);
    if (mongoose.isValidObjectId(id)) await ImageFile.deleteOne({ _id: id });
    return;
  }
  if (isCloudinaryConfigured()) await cloudinary.uploader.destroy(publicId);
};

/** GET /api/uploads/:id — a photo kept in MongoDB */
const serveStoredImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const image = mongoose.isValidObjectId(id) ? await ImageFile.findById(id) : null;
    if (!image) return res.status(404).json({ status: 'fail', message: 'Photo not found.' });
    res.set({
      'Content-Type': image.contentType,
      // A photo never changes under the same id, so browsers and Vercel's CDN can keep it
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(image.data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  cloudinary,
  upload,
  handleUploadErrors,
  uploadToCloudinary,
  storeImage,
  deleteStoredImage,
  serveStoredImage,
};
