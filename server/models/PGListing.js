const mongoose = require('mongoose');

const amenityEnum = [
  'wifi', 'ac', 'parking', 'meals', 'tv', 'security',
  'laundry', 'gym', 'garden', 'cctv', 'power-backup',
  'housekeeping', 'water_purifier',
];

const pgListingSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    propertyType: {
      type: String,
      enum: ['pg', 'flat'],
      default: 'pg',
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    location: {
      address: { type: String, required: [true, 'Address is required'] },
      city: { type: String, required: [true, 'City is required'], lowercase: true, trim: true },
      state: { type: String, required: [true, 'State is required'] },
      pincode: { type: String, required: [true, 'Pincode is required'] },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    rent: {
      type: Number,
      required: [true, 'Rent is required'],
      min: [0, 'Rent cannot be negative'],
    },
    deposit: {
      type: Number,
      default: 0,
      min: [0, 'Deposit cannot be negative'],
    },
    genderPreference: {
      type: String,
      enum: ['male', 'female', 'any'],
      required: [true, 'Gender preference is required'],
    },
    // Sharing type only applies to PGs; flats are described by BHK instead
    roomType: {
      type: String,
      enum: ['single', 'double', 'triple', 'dormitory'],
      required: [function () { return this.propertyType !== 'flat'; }, 'Room type is required'],
    },
    bhk: {
      type: Number,
      min: [1, 'BHK must be at least 1'],
      max: [10, 'BHK cannot exceed 10'],
      required: [function () { return this.propertyType === 'flat'; }, 'BHK is required for flats'],
    },
    amenities: [
      {
        type: String,
        enum: amenityEnum,
      },
    ],
    totalRooms: {
      type: Number,
      required: true,
      min: 1,
    },
    availableRooms: {
      type: Number,
      required: true,
      min: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    rules: [{ type: String, trim: true }],
    rentIncludes: [{ type: String, trim: true }],
    additionalCharges: { type: String, trim: true },
    // Ratings
    ratingAverage: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot be above 5'],
      set: (val) => Math.round(val * 10) / 10,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
    // Analytics
    analytics: {
      views: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      inquiries: { type: Number, default: 0 },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient filtering
pgListingSchema.index({ 'location.city': 1 });
pgListingSchema.index({ propertyType: 1 });
pgListingSchema.index({ rent: 1 });
pgListingSchema.index({ genderPreference: 1 });
pgListingSchema.index({ isAvailable: 1 });
pgListingSchema.index({ owner: 1 });
pgListingSchema.index({ 'location.city': 1, rent: 1, genderPreference: 1 });
pgListingSchema.index({ 'location.coordinates.lat': 1, 'location.coordinates.lng': 1 }); // proximity queries

// Soft delete filter — async hooks use the returned Promise; no `next` needed
pgListingSchema.pre(/^find/, function () {
  this.where({ isDeleted: { $ne: true } });
});

module.exports = mongoose.model('PGListing', pgListingSchema);
