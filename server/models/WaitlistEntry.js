const mongoose = require('mongoose');

// One row per email address that joined the waitlist on the front page
const waitlistEntrySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email is too long'],
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WaitlistEntry', waitlistEntrySchema);
