const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
      default: '',
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs without email (phone-only users)
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    // Confirmed with an emailed code at sign-up, or by Google
    emailVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true, // only phone/social users have this
      index: true,
    },
    role: {
      type: String,
      enum: ['student', 'owner'],
      default: 'student',
    },
    phone: {
      type: String,
      match: [/^\+?[0-9]{10,15}$/, 'Please enter a valid phone number'],
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    refreshToken: {
      type: String,
      select: false,
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ role: 1 });

// Hash password before save — only if password is set and modified
userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Soft delete filter
userSchema.pre(/^find/, function () {
  this.where({ isDeleted: { $ne: true } });
});

// Omit sensitive fields in JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
