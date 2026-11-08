const PGListing = require('../models/PGListing');
const AppError = require('../utils/AppError');

// ── Haversine formula ─────────────────────────────────────────────────────────
// Returns distance in km between two lat/lng points
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Brokers set these. Ratings, view counts, the owner and photos are managed by the server.
const EDITABLE_FIELDS = [
  'propertyType', 'title', 'description', 'location', 'rent', 'deposit', 'genderPreference',
  'roomType', 'bhk', 'amenities', 'totalRooms', 'availableRooms', 'isAvailable', 'rules',
  'rentIncludes', 'additionalCharges',
];
const pickEditable = (data = {}) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((key) => key in data).map((key) => [key, data[key]]));

const escapeRegex = (text) => String(text).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a MongoDB filter object from query params.
 * Note: lat/lng/radius are handled separately in getAllPGs via bounding box +
 * Haversine post-filter, not inside this function.
 */
const buildFilter = (query) => {
  // Set here as well as in the model's find hook, which countDocuments doesn't run
  const filter = { isDeleted: { $ne: true } };

  if (query.city) filter['location.city'] = { $regex: escapeRegex(query.city), $options: 'i' };
  // Free-text search over name, address and city (escaped — user input is not a regex)
  if (query.q && String(query.q).trim()) {
    const pattern = { $regex: escapeRegex(query.q), $options: 'i' };
    filter.$or = [{ title: pattern }, { 'location.address': pattern }, { 'location.city': pattern }];
  }
  // Listings created before flats existed have no propertyType — they're PGs
  if (query.propertyType === 'pg') filter.propertyType = { $ne: 'flat' };
  if (query.propertyType === 'flat') filter.propertyType = 'flat';
  // "3" = exactly 3 BHK, "3+" = 3 or more
  if (query.bhk) {
    const min = parseInt(query.bhk);
    if (!isNaN(min)) filter.bhk = String(query.bhk).endsWith('+') ? { $gte: min } : min;
  }
  if (query.genderPreference) filter.genderPreference = query.genderPreference;
  if (query.roomType) filter.roomType = query.roomType;
  if (query.isAvailable !== undefined) filter.isAvailable = query.isAvailable === 'true';

  // Support both minRent/maxRent (frontend) and minPrice/maxPrice (legacy)
  const minRent = query.minRent || query.minPrice;
  const maxRent = query.maxRent || query.maxPrice;
  if (minRent || maxRent) {
    filter.rent = {};
    if (minRent) filter.rent.$gte = Number(minRent);
    if (maxRent) filter.rent.$lte = Number(maxRent);
  }

  // Filter to only available rooms (availableRooms > 0)
  if (query.availableOnly === 'true') {
    filter.availableRooms = { $gt: 0 };
  }

  if (query.amenities) {
    const amenitiesArr = Array.isArray(query.amenities)
      ? query.amenities
      : query.amenities.split(',');
    filter.amenities = { $all: amenitiesArr };
  }

  return filter;
};

/**
 * Get all PG listings with filtering, sorting, and pagination.
 * Supports proximity search via lat/lng/radius query params (Haversine).
 */
exports.getAllPGs = async (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, parseInt(query.limit) || 12);
  const skip = (page - 1) * limit;

  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { rent: 1 },
    price_desc: { rent: -1 },
    rent_asc: { rent: 1 },
    rent_desc: { rent: -1 },
    popular: { 'analytics.views': -1 },
  };
  const sort = sortOptions[query.sort] || { createdAt: -1 };

  const filter = buildFilter(query);

  // ── Proximity filter (lat/lng/radius) ──────────────────────────────────────
  const hasProximity =
    query.lat && query.lng && !isNaN(Number(query.lat)) && !isNaN(Number(query.lng));

  if (hasProximity) {
    const centerLat = Number(query.lat);
    const centerLng = Number(query.lng);
    const radiusKm = Math.min(Number(query.radius) || 3, 50); // cap at 50 km

    // 1° of latitude ≈ 111 km; 1° of longitude ≈ 111 * cos(lat) km
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));

    // Step 1: Fast bounding-box pre-filter to reduce DB scan
    filter['location.coordinates.lat'] = {
      $gte: centerLat - latDelta,
      $lte: centerLat + latDelta,
    };
    filter['location.coordinates.lng'] = {
      $gte: centerLng - lngDelta,
      $lte: centerLng + lngDelta,
    };

    // Step 2: Fetch bounding-box candidates (no pagination yet)
    const candidates = await PGListing.find(filter)
      .sort(sort)
      .populate('owner', 'name avatar')
      .lean();

    // Step 3: Exact Haversine post-filter
    const nearby = candidates.filter((pg) => {
      const { lat, lng } = pg.location?.coordinates || {};
      if (lat == null || lng == null) return false;
      return haversineKm(centerLat, centerLng, lat, lng) <= radiusKm;
    });

    // Step 4: Manual pagination on filtered results
    const total = nearby.length;
    const paginated = nearby.slice(skip, skip + limit);

    return {
      listings: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Standard path (no proximity)
  const [listings, total] = await Promise.all([
    PGListing.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('owner', 'name avatar')
      .lean(),
    PGListing.countDocuments(filter),
  ]);

  return {
    listings,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Get a single PG by ID and count the view (a broker opening their own listing isn't one).
 * The broker's phone number is only for signed-in users.
 */
exports.getPGById = async (id, viewerId) => {
  const pg = await PGListing.findById(id).populate('owner', viewerId ? 'name phone avatar' : 'name avatar');
  if (!pg) throw new AppError('PG listing not found.', 404);

  if (String(pg.owner?._id) !== String(viewerId)) {
    await PGListing.updateOne({ _id: id }, { $inc: { 'analytics.views': 1 } }, { timestamps: false });
    pg.analytics.views += 1;
  }
  return pg;
};

/**
 * Create a new PG listing
 */
exports.createPG = async (ownerId, data) => {
  const pg = await PGListing.create({ ...pickEditable(data), owner: ownerId });
  return pg;
};

/**
 * Update a PG listing (owner only)
 */
exports.updatePG = async (id, ownerId, data) => {
  const pg = await PGListing.findOne({ _id: id, owner: ownerId });
  if (!pg) throw new AppError('PG not found or you are not authorized to update it.', 404);

  Object.assign(pg, pickEditable(data));
  await pg.save();
  return pg;
};

/**
 * Soft delete a PG listing (owner only)
 */
exports.deletePG = async (id, ownerId) => {
  const pg = await PGListing.findOneAndUpdate(
    { _id: id, owner: ownerId },
    { isDeleted: true },
    { returnDocument: 'after' }
  );
  if (!pg) throw new AppError('PG not found or you are not authorized to delete it.', 404);
  return pg;
};

/** Throws unless this listing exists and belongs to this broker */
exports.assertOwner = async (id, ownerId) => {
  if (!(await PGListing.exists({ _id: id, owner: ownerId, isDeleted: { $ne: true } }))) {
    throw new AppError('PG not found or not authorized.', 404);
  }
};

/**
 * Add images to a PG listing
 */
exports.addImages = async (id, ownerId, images) => {
  const pg = await PGListing.findOne({ _id: id, owner: ownerId });
  if (!pg) throw new AppError('PG not found or not authorized.', 404);

  // images is already an array of { url, publicId } objects (processed by controller)
  pg.images.push(...images);
  await pg.save();
  return pg;
};

/**
 * Remove an image from a PG listing
 */
exports.removeImage = async (id, ownerId, publicId, deleteStoredImage) => {
  const pg = await PGListing.findOne({ _id: id, owner: ownerId });
  if (!pg) throw new AppError('PG not found or not authorized.', 404);
  // Only delete files that belong to this listing
  if (!pg.images.some((img) => img.publicId === publicId)) {
    throw new AppError('Image not found on this listing.', 404);
  }

  await deleteStoredImage(publicId);
  pg.images = pg.images.filter((img) => img.publicId !== publicId);
  await pg.save();
  return pg;
};

/**
 * Get all PG listings by the logged-in owner
 */
exports.getOwnerPGs = async (ownerId) => {
  return PGListing.find({ owner: ownerId }).sort({ createdAt: -1 }).lean();
};
