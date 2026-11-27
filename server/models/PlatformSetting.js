const mongoose = require('mongoose');

/**
 * Site-wide settings, changed from the admin panel. There is only ever one document (key: 'platform').
 * Defaults match how the site ran before the admin panel existed: waitlist only.
 */
const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform', unique: true, immutable: true },
    // waitlist: only the waitlist page · public: the full app · maintenance: "back soon" page
    mode: {
      type: String,
      enum: ['waitlist', 'public', 'maintenance'],
      default: 'waitlist',
    },
    // Cities the team works in; offered in the admin property form
    cities: { type: [String], default: ['jorhat'] },
    // Which property types students can see in the app
    propertyTypes: {
      pg: { type: Boolean, default: true },
      flat: { type: Boolean, default: true },
    },
    // A short line shown at the top of the landing page; blank hides it
    announcement: { type: String, trim: true, maxlength: 200, default: '' },
    // Under the big number on the waitlist page; blank keeps the built-in text
    waitlistMessage: { type: String, trim: true, maxlength: 200, default: '' },
    maintenanceMessage: { type: String, trim: true, maxlength: 300, default: '' },
    // When on, listings added by brokers wait for admin approval before students can see them
    requireApproval: { type: Boolean, default: false },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

platformSettingSchema.statics.get = async function () {
  return (
    (await this.findOne({ key: 'platform' })) ||
    this.findOneAndUpdate({ key: 'platform' }, { $setOnInsert: { key: 'platform' } }, { upsert: true, returnDocument: 'after' })
  );
};

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
