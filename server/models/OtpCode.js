const mongoose = require('mongoose');

/**
 * 6-digit codes emailed at sign-up to confirm the address.
 * Only an HMAC of the code is stored; expired rows are removed by the TTL index.
 */
const otpCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ['login', 'signup'], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpCodeSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);
