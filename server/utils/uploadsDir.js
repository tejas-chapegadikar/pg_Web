const path = require('path');

// Where listing photos are saved when Cloudinary isn't configured (local development)
module.exports = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
