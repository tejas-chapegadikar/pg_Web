const mongoose = require('mongoose');

/**
 * What each admin did in the admin panel. Written by the server only; there is no route
 * to edit or delete these, so the founder and co-founder can trust what they see.
 */
const activityLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: String,
    adminEmail: String,
    adminRole: String,
    action: { type: String, required: true }, // e.g. 'property.update'
    targetType: { type: String }, // 'property' | 'user' | 'waitlist' | 'settings'
    targetId: { type: String },
    summary: { type: String }, // a human-readable line, e.g. the listing title
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ admin: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });

// Refuse edits at the model level too
const refuse = function () {
  throw new Error('Activity logs cannot be changed.');
};
activityLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], refuse);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
