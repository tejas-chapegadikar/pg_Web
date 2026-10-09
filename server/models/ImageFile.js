const mongoose = require('mongoose');

/**
 * Listing photos kept in MongoDB when Cloudinary isn't set up. The website shrinks
 * photos before upload (a few hundred KB each), so they fit comfortably in a document.
 * Served at GET /api/uploads/:id.
 */
const imageFileSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ImageFile', imageFileSchema);
