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
    // Who they are, so we know how many students and brokers are waiting
    role: {
      type: String,
      enum: ['student', 'owner'],
      default: 'student',
    },
    // Optional details the team can fill in after contacting them (the join form only asks for email)
    name: { type: String, trim: true, maxlength: 60 },
    phone: { type: String, trim: true, maxlength: 20 },
    college: { type: String, trim: true, maxlength: 100 },
    city: { type: String, trim: true, maxlength: 60 },
    // Follow-up by the team. Rows from before this existed count as 'new'.
    status: {
      type: String,
      enum: ['new', 'contacted', 'interested', 'converted'],
      default: 'new',
    },
    notes: [
      {
        text: { type: String, trim: true, maxlength: 1000, required: true },
        by: { type: String, trim: true }, // admin's name or email
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

waitlistEntrySchema.index({ createdAt: -1 });
waitlistEntrySchema.index({ status: 1 });

module.exports = mongoose.model('WaitlistEntry', waitlistEntrySchema);
