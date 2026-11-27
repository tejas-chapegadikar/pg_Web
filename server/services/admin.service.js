const mongoose = require('mongoose');
const PGListing = require('../models/PGListing');
const User = require('../models/User');
const WaitlistEntry = require('../models/WaitlistEntry');
const Inquiry = require('../models/Inquiry');
const SavedListing = require('../models/SavedListing');
const PlatformSetting = require('../models/PlatformSetting');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const { adminRoleOf, isConfiguredAdmin } = require('../utils/adminAccess');
const { EDITABLE_FIELDS, publicFilter } = require('./pg.service');

const TZ = 'Asia/Kolkata';
const DAY = 24 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

const escapeRegex = (text) => String(text).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const like = (text) => ({ $regex: escapeRegex(text), $options: 'i' });

const paging = (query, max = 100) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};
const pageInfo = (total, page, limit) => ({ total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });

const assertId = (id, what = 'Record') => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`${what} not found.`, 404);
};

/** Only the fields that changed, before and after, for the activity log */
const diff = (before, after, keys) => {
  const b = {};
  const a = {};
  for (const key of keys) {
    const x = JSON.stringify(before?.[key] ?? null);
    const y = JSON.stringify(after?.[key] ?? null);
    if (x !== y) {
      b[key] = before?.[key] ?? null;
      a[key] = after?.[key] ?? null;
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
};

/** Write one activity log row. Never throws: a failed log must not undo the admin's change. */
const log = async (admin, entry) => {
  try {
    await ActivityLog.create({
      admin: admin.user._id,
      adminName: admin.user.name,
      adminEmail: admin.user.email,
      adminRole: admin.role,
      ...entry,
    });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
};
exports.log = log;

/** Count per day for the last `days` days, with empty days filled in as 0 */
const perDay = async (Model, match, days) => {
  const since = new Date(Date.now() - (days - 1) * DAY);
  since.setHours(0, 0, 0, 0);
  const rows = await Model.aggregate([
    { $match: { ...match, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } },
  ]);
  const byDay = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return Array.from({ length: days }, (_, i) => {
    const date = fmt.format(new Date(Date.now() - (days - 1 - i) * DAY));
    return { date, count: byDay[date] || 0 };
  });
};

const groupCount = async (Model, match, field, limit = 10) => {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: { $ifNull: [`$${field}`, ''] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({ label: r._id || 'Not given', count: r.count }));
};

const NOT_DELETED = { isDeleted: { $ne: true } };

// ── Overview & analytics ─────────────────────────────────────────────────────

exports.overview = async () => {
  const settings = await PlatformSetting.get();
  const live = publicFilter(settings);
  const weekAgo = new Date(Date.now() - 7 * DAY);

  const [
    totalListings, activePG, activeFlat, pending,
    waitlistTotal, waitlistNewWeek, waitlistUncontacted,
    students, brokers,
    recentProperties, recentUsers,
    waitlistTrend, listingTrend, typeSplit, listingsByCity,
  ] = await Promise.all([
    PGListing.countDocuments(NOT_DELETED),
    // "Active" = students can see it right now
    settings.propertyTypes?.pg === false ? 0 : PGListing.countDocuments({ ...live, propertyType: { $ne: 'flat' } }),
    settings.propertyTypes?.flat === false ? 0 : PGListing.countDocuments({ ...live, propertyType: 'flat' }),
    PGListing.countDocuments({ ...NOT_DELETED, status: 'pending' }),
    WaitlistEntry.countDocuments(),
    WaitlistEntry.countDocuments({ createdAt: { $gte: weekAgo } }),
    WaitlistEntry.countDocuments({ status: { $in: ['new', null] } }),
    User.countDocuments({ ...NOT_DELETED, role: 'student' }),
    User.countDocuments({ ...NOT_DELETED, role: 'owner' }),
    PGListing.find().sort({ createdAt: -1 }).limit(5).populate('owner', 'name email').lean(),
    User.find().sort({ createdAt: -1 }).limit(5).lean(),
    perDay(WaitlistEntry, {}, 30),
    perDay(PGListing, NOT_DELETED, 30),
    groupCount(PGListing, NOT_DELETED, 'propertyType'),
    groupCount(PGListing, NOT_DELETED, 'location.city', 8),
  ]);

  return {
    mode: settings.mode,
    stats: {
      totalListings, activePG, activeFlat, pending,
      waitlistTotal, waitlistNewWeek, waitlistUncontacted,
      students, brokers,
    },
    recentProperties,
    recentUsers: recentUsers.map(({ password, refreshToken, refreshTokens, passwordResetToken, passwordResetExpires, ...u }) => u),
    charts: {
      waitlistTrend,
      listingTrend,
      // Listings made before flats existed have no type: they're PGs
      typeSplit: [
        { label: 'PG', count: typeSplit.filter((r) => r.label !== 'flat').reduce((s, r) => s + r.count, 0) },
        { label: 'Flat', count: typeSplit.find((r) => r.label === 'flat')?.count || 0 },
      ],
      listingsByCity,
    },
  };
};

exports.analytics = async (query) => {
  const days = [7, 30, 90, 365].includes(Number(query.days)) ? Number(query.days) : 30;
  const since = new Date(Date.now() - days * DAY);
  const [
    waitlistTrend, listingTrend, userTrend,
    waitlistByCity, waitlistByCollege, waitlistByStatus, waitlistByRole,
    listingsByCity, listingsByGender, usersByRole,
    rentStats, topViewed,
    inquiries,
  ] = await Promise.all([
    perDay(WaitlistEntry, {}, days),
    perDay(PGListing, NOT_DELETED, days),
    perDay(User, NOT_DELETED, days),
    groupCount(WaitlistEntry, {}, 'city'),
    groupCount(WaitlistEntry, {}, 'college'),
    groupCount(WaitlistEntry, {}, 'status'),
    groupCount(WaitlistEntry, {}, 'role'),
    groupCount(PGListing, NOT_DELETED, 'location.city'),
    groupCount(PGListing, NOT_DELETED, 'genderPreference'),
    groupCount(User, NOT_DELETED, 'role'),
    PGListing.aggregate([
      { $match: NOT_DELETED },
      { $group: { _id: { $cond: [{ $eq: ['$propertyType', 'flat'] }, 'flat', 'pg'] }, avg: { $avg: '$rent' }, min: { $min: '$rent' }, max: { $max: '$rent' }, count: { $sum: 1 } } },
    ]),
    PGListing.find().sort({ 'analytics.views': -1 }).limit(5).select('title propertyType analytics location.city').lean(),
    Inquiry.countDocuments({ createdAt: { $gte: since } }),
  ]);

  const sum = (rows) => rows.reduce((s, r) => s + r.count, 0);
  return {
    days,
    totals: {
      waitlist: sum(waitlistTrend),
      listings: sum(listingTrend),
      users: sum(userTrend),
      inquiries,
    },
    waitlistTrend, listingTrend, userTrend,
    waitlistByCity, waitlistByCollege, waitlistByStatus, waitlistByRole,
    listingsByCity, listingsByGender, usersByRole,
    rent: rentStats.map((r) => ({ type: r._id, avg: Math.round(r.avg || 0), min: r.min, max: r.max, count: r.count })),
    topViewed,
  };
};

// ── Properties ───────────────────────────────────────────────────────────────

// Admins can set everything a broker can, plus the contact person
const ADMIN_FIELDS = [...EDITABLE_FIELDS, 'contact'];
const pickAdmin = (data = {}) => Object.fromEntries(ADMIN_FIELDS.filter((k) => k in data).map((k) => [k, data[k]]));
const LOGGED_FIELDS = [...ADMIN_FIELDS, 'status', 'isActive', 'isVerified', 'rejectionReason', 'owner'];

/** Where a listing stands, for filters and badges */
const STATUS_FILTERS = {
  live: { isActive: { $ne: false }, status: { $nin: ['pending', 'rejected'] } },
  pending: { status: 'pending' },
  rejected: { status: 'rejected' },
  inactive: { isActive: false },
  verified: { isVerified: true },
};

exports.listProperties = async (query) => {
  const { page, limit, skip } = paging(query);
  const filter = { ...NOT_DELETED };
  if (query.q && String(query.q).trim()) {
    const p = like(query.q);
    filter.$or = [{ title: p }, { 'location.address': p }, { 'location.city': p }, { 'location.locality': p }, { 'contact.name': p }];
  }
  if (query.type === 'pg') filter.propertyType = { $ne: 'flat' };
  if (query.type === 'flat') filter.propertyType = 'flat';
  if (STATUS_FILTERS[query.status]) Object.assign(filter, STATUS_FILTERS[query.status]);
  if (query.city) filter['location.city'] = String(query.city).toLowerCase();
  if (['male', 'female', 'any'].includes(query.gender)) filter.genderPreference = query.gender;

  const sorts = {
    newest: { createdAt: -1 }, oldest: { createdAt: 1 },
    rent_asc: { rent: 1 }, rent_desc: { rent: -1 }, views: { 'analytics.views': -1 },
  };
  const [items, total, cities] = await Promise.all([
    PGListing.find(filter).sort(sorts[query.sort] || sorts.newest).skip(skip).limit(limit).populate('owner', 'name email role').lean(),
    PGListing.countDocuments(filter),
    PGListing.distinct('location.city', NOT_DELETED),
  ]);
  return { items, pagination: pageInfo(total, page, limit), cities: cities.filter(Boolean).sort() };
};

exports.getProperty = async (id) => {
  assertId(id, 'Listing');
  const pg = await PGListing.findById(id).populate('owner', 'name email phone role').lean();
  if (!pg) throw new AppError('Listing not found.', 404);
  return pg;
};

/** Listings an admin adds belong to the admin, or to a broker picked by email */
const resolveOwner = async (ownerEmail, fallbackId) => {
  if (!ownerEmail) return fallbackId;
  const owner = await User.findOne({ email: String(ownerEmail).trim().toLowerCase() });
  if (!owner) throw new AppError('No account with that broker email.', 400);
  if (owner.role !== 'owner') throw new AppError('That account is a student, not a broker.', 400);
  return owner._id;
};

exports.createProperty = async (admin, data) => {
  const pg = await PGListing.create({
    ...pickAdmin(data),
    owner: await resolveOwner(data.ownerEmail, admin.user._id),
    status: 'approved',
    isActive: data.isActive !== false,
    isVerified: data.isVerified === true,
  });
  await log(admin, {
    action: 'property.create', targetType: 'property', targetId: String(pg._id), summary: pg.title,
    after: { title: pg.title, propertyType: pg.propertyType, rent: pg.rent, city: pg.location?.city },
  });
  return pg;
};

exports.updateProperty = async (admin, id, data) => {
  assertId(id, 'Listing');
  const pg = await PGListing.findById(id);
  if (!pg) throw new AppError('Listing not found.', 404);
  const before = pg.toObject();

  Object.assign(pg, pickAdmin(data));
  if (data.ownerEmail !== undefined && data.ownerEmail !== '') pg.owner = await resolveOwner(data.ownerEmail, pg.owner);
  if (typeof data.isVerified === 'boolean') pg.isVerified = data.isVerified;
  if (typeof data.isActive === 'boolean') pg.isActive = data.isActive;
  await pg.save();

  const changes = diff(before, pg.toObject(), LOGGED_FIELDS);
  if (changes.changed.length) {
    await log(admin, {
      action: 'property.update', targetType: 'property', targetId: id, summary: pg.title,
      before: changes.before, after: changes.after,
    });
  }
  return pg;
};

const STATUS_ACTIONS = {
  approve: { set: { status: 'approved', rejectionReason: undefined }, action: 'property.approve' },
  reject: { set: { status: 'rejected' }, action: 'property.reject' },
  deactivate: { set: { isActive: false }, action: 'property.deactivate' },
  activate: { set: { isActive: true }, action: 'property.activate' },
  verify: { set: { isVerified: true }, action: 'property.verify' },
  unverify: { set: { isVerified: false }, action: 'property.unverify' },
};

exports.setPropertyStatus = async (admin, id, { action, reason }) => {
  assertId(id, 'Listing');
  const step = STATUS_ACTIONS[action];
  if (!step) throw new AppError('Unknown action.', 400);
  const pg = await PGListing.findById(id);
  if (!pg) throw new AppError('Listing not found.', 404);
  const before = pg.toObject();

  Object.assign(pg, step.set);
  if (action === 'reject') pg.rejectionReason = String(reason || '').trim().slice(0, 300) || undefined;
  await pg.save({ validateBeforeSave: false }); // older listings may miss fields added later; don't block a status change on that

  const changes = diff(before, pg.toObject(), ['status', 'isActive', 'isVerified', 'rejectionReason']);
  await log(admin, { action: step.action, targetType: 'property', targetId: id, summary: pg.title, before: changes.before, after: changes.after });
  return pg;
};

/** Soft delete, like brokers' own delete: the record stays in the database */
exports.deleteProperty = async (admin, id) => {
  assertId(id, 'Listing');
  const pg = await PGListing.findOneAndUpdate({ _id: id }, { isDeleted: true }, { returnDocument: 'after' });
  if (!pg) throw new AppError('Listing not found.', 404);
  await log(admin, { action: 'property.delete', targetType: 'property', targetId: id, summary: pg.title, before: { isDeleted: false }, after: { isDeleted: true } });
};

exports.addImages = async (admin, id, images) => {
  const pg = await PGListing.findById(id);
  if (!pg) throw new AppError('Listing not found.', 404);
  pg.images.push(...images);
  await pg.save({ validateBeforeSave: false });
  await log(admin, { action: 'property.photos_add', targetType: 'property', targetId: String(id), summary: `${pg.title} (+${images.length} photo${images.length === 1 ? '' : 's'})` });
  return pg;
};

exports.assertProperty = async (id) => {
  assertId(id, 'Listing');
  if (!(await PGListing.exists({ _id: id, ...NOT_DELETED }))) throw new AppError('Listing not found.', 404);
};

exports.removeImage = async (admin, id, publicId, deleteStoredImage) => {
  assertId(id, 'Listing');
  const pg = await PGListing.findById(id);
  if (!pg) throw new AppError('Listing not found.', 404);
  if (!pg.images.some((img) => img.publicId === publicId)) throw new AppError('Photo not found on this listing.', 404);
  await deleteStoredImage(publicId);
  pg.images = pg.images.filter((img) => img.publicId !== publicId);
  await pg.save({ validateBeforeSave: false });
  await log(admin, { action: 'property.photo_delete', targetType: 'property', targetId: String(id), summary: pg.title });
  return pg;
};

/** New photo order (cover first); only photos already on the listing */
exports.reorderImages = async (admin, id, order) => {
  assertId(id, 'Listing');
  const pg = await PGListing.findById(id);
  if (!pg) throw new AppError('Listing not found.', 404);
  if (!Array.isArray(order)) throw new AppError('Invalid photo order.', 400);
  const byId = new Map(pg.images.map((img) => [img.publicId, img]));
  const next = order.map((p) => byId.get(p)).filter(Boolean);
  if (next.length !== pg.images.length) throw new AppError('Invalid photo order.', 400);
  pg.images = next;
  await pg.save({ validateBeforeSave: false });
  await log(admin, { action: 'property.photos_reorder', targetType: 'property', targetId: String(id), summary: pg.title });
  return pg;
};

// ── Waitlist ─────────────────────────────────────────────────────────────────

const waitlistFilter = (query) => {
  const filter = {};
  if (query.q && String(query.q).trim()) {
    const p = like(query.q);
    filter.$or = [{ email: p }, { name: p }, { phone: p }];
  }
  if (query.status === 'new') filter.status = { $in: ['new', null] };
  else if (['contacted', 'interested', 'converted'].includes(query.status)) filter.status = query.status;
  if (['student', 'owner'].includes(query.role)) filter.role = query.role === 'owner' ? 'owner' : { $ne: 'owner' };
  if (query.college) filter.college = like(query.college);
  if (query.city) filter.city = like(query.city);
  return filter;
};

exports.listWaitlist = async (query) => {
  const { page, limit, skip } = paging(query);
  const filter = waitlistFilter(query);
  const sort = query.sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
  const [items, total, colleges, cities, statusRows] = await Promise.all([
    WaitlistEntry.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    WaitlistEntry.countDocuments(filter),
    WaitlistEntry.distinct('college'),
    WaitlistEntry.distinct('city'),
    WaitlistEntry.aggregate([{ $group: { _id: { $ifNull: ['$status', 'new'] }, count: { $sum: 1 } } }]),
  ]);
  return {
    items: items.map((e) => ({ ...e, status: e.status || 'new' })),
    pagination: pageInfo(total, page, limit),
    colleges: colleges.filter(Boolean).sort(),
    cities: cities.filter(Boolean).sort(),
    statusCounts: Object.fromEntries(statusRows.map((r) => [r._id, r.count])),
  };
};

exports.getWaitlistEntry = async (id) => {
  assertId(id, 'Registration');
  const entry = await WaitlistEntry.findById(id).lean();
  if (!entry) throw new AppError('Registration not found.', 404);
  // Did they go on to make an account?
  const account = await User.findOne({ email: entry.email }).select('name role createdAt isSuspended').lean();
  return { ...entry, status: entry.status || 'new', account };
};

const WAITLIST_FIELDS = ['status', 'name', 'phone', 'college', 'city'];

exports.updateWaitlistEntry = async (admin, id, data) => {
  assertId(id, 'Registration');
  const entry = await WaitlistEntry.findById(id);
  if (!entry) throw new AppError('Registration not found.', 404);
  const before = entry.toObject();
  for (const key of WAITLIST_FIELDS) {
    if (key in data) entry[key] = typeof data[key] === 'string' ? data[key].trim() : data[key];
  }
  await entry.save();
  const changes = diff(before, entry.toObject(), WAITLIST_FIELDS);
  if (changes.changed.length) {
    await log(admin, {
      action: changes.changed.includes('status') ? 'waitlist.status' : 'waitlist.update',
      targetType: 'waitlist', targetId: id, summary: entry.email, before: changes.before, after: changes.after,
    });
  }
  return entry;
};

exports.addWaitlistNote = async (admin, id, text) => {
  assertId(id, 'Registration');
  const value = String(text || '').trim();
  if (!value) throw new AppError('Write a note first.', 400);
  const entry = await WaitlistEntry.findById(id);
  if (!entry) throw new AppError('Registration not found.', 404);
  entry.notes.push({ text: value.slice(0, 1000), by: admin.user.name || admin.user.email });
  await entry.save();
  await log(admin, { action: 'waitlist.note', targetType: 'waitlist', targetId: id, summary: entry.email, after: { note: value.slice(0, 200) } });
  return entry;
};

/** CSV of the filtered waitlist. Cells starting with = + - @ are quoted so spreadsheets don't run them. */
exports.exportWaitlist = async (admin, query) => {
  const rows = await WaitlistEntry.find(waitlistFilter(query)).sort({ createdAt: -1 }).lean();
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Email', 'Name', 'Phone', 'College', 'City', 'Type', 'Status', 'Joined', 'Notes'];
  const lines = rows.map((r) =>
    [
      r.email, r.name, r.phone, r.college, r.city,
      r.role === 'owner' ? 'Broker' : 'Student',
      r.status || 'new',
      new Date(r.createdAt).toISOString(),
      (r.notes || []).map((n) => n.text).join(' | '),
    ].map(cell).join(',')
  );
  await log(admin, { action: 'waitlist.export', targetType: 'waitlist', summary: `${rows.length} rows exported` });
  return '﻿' + [header.join(','), ...lines].join('\r\n');
};

// ── Users ────────────────────────────────────────────────────────────────────

const publicUser = (u) => {
  const { password, refreshToken, refreshTokens, passwordResetToken, passwordResetExpires, __v, ...rest } = u;
  return { ...rest, adminRole: adminRoleOf(u), adminFromConfig: isConfiguredAdmin(u) };
};

exports.listUsers = async (query) => {
  const { page, limit, skip } = paging(query);
  const filter = {};
  if (query.q && String(query.q).trim()) {
    const p = like(query.q);
    filter.$or = [{ name: p }, { email: p }, { phone: p }];
  }
  if (['student', 'owner'].includes(query.role)) filter.role = query.role;
  if (query.status === 'suspended') filter.isSuspended = true;
  if (query.status === 'active') filter.isSuspended = { $ne: true };
  if (query.status === 'admin') filter.adminRole = { $in: ['founder', 'cofounder'] };
  const sort = query.sort === 'oldest' ? { createdAt: 1 } : query.sort === 'name' ? { name: 1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments({ ...filter, ...NOT_DELETED }),
  ]);
  // How many listings each broker has, in one query
  const ids = items.map((u) => u._id);
  const counts = await PGListing.aggregate([{ $match: { owner: { $in: ids }, ...NOT_DELETED } }, { $group: { _id: '$owner', count: { $sum: 1 } } }]);
  const byOwner = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  return {
    items: items.map((u) => ({ ...publicUser(u), listingCount: byOwner[String(u._id)] || 0 })),
    pagination: pageInfo(total, page, limit),
  };
};

exports.getUser = async (id) => {
  assertId(id, 'User');
  const user = await User.findById(id).lean();
  if (!user) throw new AppError('User not found.', 404);
  const [listings, inquiriesSent, inquiriesReceived, saves, waitlist, logs] = await Promise.all([
    PGListing.find({ owner: id }).sort({ createdAt: -1 }).select('title propertyType rent status isActive createdAt location.city').limit(20).lean(),
    Inquiry.countDocuments({ student: id }),
    Inquiry.countDocuments({ owner: id }),
    SavedListing.countDocuments({ student: id }),
    user.email ? WaitlistEntry.findOne({ email: user.email }).select('createdAt status').lean() : null,
    ActivityLog.find({ targetType: 'user', targetId: String(id) }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  return { user: publicUser(user), listings, activity: { inquiriesSent, inquiriesReceived, saves, waitlist }, logs };
};

/**
 * Change a user's type, suspend or reactivate them, or (founder only) give or take admin access.
 * Admins can't change their own account here, so nobody can promote or unlock themselves.
 */
exports.updateUser = async (admin, id, data) => {
  assertId(id, 'User');
  if (String(admin.user._id) === String(id)) throw new AppError('You can’t change your own account from the admin panel.', 403);
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found.', 404);
  const before = user.toObject();
  const targetAdmin = adminRoleOf(user);

  if (isConfiguredAdmin(user) && ('isSuspended' in data || 'adminRole' in data)) {
    throw new AppError('This admin is set in the server settings and can’t be changed here.', 403);
  }
  if (targetAdmin && admin.role !== 'founder') {
    throw new AppError('Only the founder can change another admin’s account.', 403);
  }

  if ('role' in data) {
    if (!['student', 'owner'].includes(data.role)) throw new AppError('Choose student or broker.', 400);
    user.role = data.role;
  }
  if ('isSuspended' in data) {
    user.isSuspended = data.isSuspended === true;
    user.suspendedReason = user.isSuspended ? String(data.reason || '').trim().slice(0, 300) || undefined : undefined;
    if (user.isSuspended) {
      // Sign them out everywhere
      user.refreshTokens = [];
      user.refreshToken = undefined;
    }
  }
  if ('adminRole' in data) {
    if (admin.role !== 'founder') throw new AppError('Only the founder can manage admin access.', 403);
    if (data.adminRole !== null && !['founder', 'cofounder'].includes(data.adminRole)) throw new AppError('Unknown admin role.', 400);
    if (data.adminRole && !user.emailVerified) throw new AppError('This account’s email isn’t verified yet, so it can’t be an admin.', 400);
    user.adminRole = data.adminRole || undefined;
  }
  await user.save({ validateBeforeSave: false });

  const changes = diff(before, user.toObject(), ['role', 'isSuspended', 'suspendedReason', 'adminRole']);
  if (changes.changed.length) {
    const action = changes.changed.includes('isSuspended')
      ? user.isSuspended ? 'user.suspend' : 'user.reactivate'
      : changes.changed.includes('adminRole') ? 'admin.permissions' : 'user.role';
    await log(admin, { action, targetType: 'user', targetId: id, summary: user.email || user.name || user.phone, before: changes.before, after: changes.after });
  }
  return publicUser(user.toObject());
};

// ── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_FIELDS = ['mode', 'cities', 'propertyTypes', 'announcement', 'waitlistMessage', 'maintenanceMessage', 'requireApproval'];
// Opening or closing the site, and the approval rule, are the founder's call
const FOUNDER_ONLY = ['mode', 'requireApproval'];

exports.getSettings = async () => PlatformSetting.get();

exports.updateSettings = async (admin, data) => {
  const settings = await PlatformSetting.get();
  const before = settings.toObject();
  const blocked = FOUNDER_ONLY.filter((k) => k in data && JSON.stringify(data[k]) !== JSON.stringify(before[k]));
  if (blocked.length && admin.role !== 'founder') {
    throw new AppError('Only the founder can change the site mode or the approval rule.', 403);
  }

  for (const key of SETTINGS_FIELDS) {
    if (!(key in data)) continue;
    let value = data[key];
    if (key === 'cities') {
      if (!Array.isArray(value)) throw new AppError('Cities must be a list.', 400);
      value = [...new Set(value.map((c) => String(c).trim().toLowerCase()).filter(Boolean))].slice(0, 50);
    }
    if (key === 'propertyTypes') value = { pg: value?.pg !== false, flat: value?.flat !== false };
    if (key === 'requireApproval') value = value === true;
    settings[key] = value;
  }
  settings.updatedBy = admin.user.email;
  await settings.save();

  const changes = diff(before, settings.toObject(), SETTINGS_FIELDS);
  if (changes.changed.length) {
    const modeChanged = changes.changed.includes('mode');
    await log(admin, {
      action: modeChanged ? 'settings.mode' : 'settings.update',
      targetType: 'settings', targetId: 'platform',
      summary: modeChanged ? `Site mode: ${before.mode} → ${settings.mode}` : `Changed ${changes.changed.join(', ')}`,
      before: changes.before, after: changes.after,
    });
  }
  return settings;
};

// ── Activity log ─────────────────────────────────────────────────────────────

exports.listLogs = async (query) => {
  const { page, limit, skip } = paging(query, 100);
  const filter = {};
  if (query.type && ['property', 'user', 'waitlist', 'settings'].includes(query.type)) filter.targetType = query.type;
  if (query.admin && mongoose.isValidObjectId(query.admin)) filter.admin = query.admin;
  if (query.targetId) filter.targetId = String(query.targetId);
  const [items, total, admins] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ActivityLog.countDocuments(filter),
    ActivityLog.aggregate([{ $group: { _id: '$admin', name: { $last: '$adminName' }, email: { $last: '$adminEmail' } } }]),
  ]);
  return { items, pagination: pageInfo(total, page, limit), admins: admins.map((a) => ({ _id: a._id, name: a.name, email: a.email })) };
};
