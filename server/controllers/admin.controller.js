const admin = require('../services/admin.service');
const { storeImage, deleteStoredImage } = require('../middleware/upload');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Who is acting, for the activity log. The role comes from requireAdmin, never from the request.
const actor = (req) => ({ user: req.user, role: req.adminRole });
const ok = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

exports.me = (req, res) => ok(res, { user: req.user, adminRole: req.adminRole });

exports.overview = catchAsync(async (req, res) => ok(res, await admin.overview()));
exports.analytics = catchAsync(async (req, res) => ok(res, await admin.analytics(req.query)));

// Properties
exports.listProperties = catchAsync(async (req, res) => ok(res, await admin.listProperties(req.query)));
exports.getProperty = catchAsync(async (req, res) => ok(res, { pg: await admin.getProperty(req.params.id) }));
exports.createProperty = catchAsync(async (req, res) => ok(res, { pg: await admin.createProperty(actor(req), req.body || {}) }, 201));
exports.updateProperty = catchAsync(async (req, res) => ok(res, { pg: await admin.updateProperty(actor(req), req.params.id, req.body || {}) }));
exports.setPropertyStatus = catchAsync(async (req, res) => ok(res, { pg: await admin.setPropertyStatus(actor(req), req.params.id, req.body || {}) }));
exports.deleteProperty = catchAsync(async (req, res) => {
  await admin.deleteProperty(actor(req), req.params.id);
  res.status(204).end();
});
exports.uploadImages = catchAsync(async (req, res) => {
  if (!req.files?.length) throw new AppError('Choose at least one photo.', 400);
  await admin.assertProperty(req.params.id); // check before storing anything
  const images = await Promise.all(req.files.map((file) => storeImage(file)));
  ok(res, { pg: await admin.addImages(actor(req), req.params.id, images) });
});
exports.deleteImage = catchAsync(async (req, res) =>
  ok(res, { pg: await admin.removeImage(actor(req), req.params.id, req.params.publicId, deleteStoredImage) })
);
exports.reorderImages = catchAsync(async (req, res) =>
  ok(res, { pg: await admin.reorderImages(actor(req), req.params.id, req.body?.order) })
);

// Users
exports.listUsers = catchAsync(async (req, res) => ok(res, await admin.listUsers(req.query)));
exports.getUser = catchAsync(async (req, res) => ok(res, await admin.getUser(req.params.id)));
exports.updateUser = catchAsync(async (req, res) => ok(res, { user: await admin.updateUser(actor(req), req.params.id, req.body || {}) }));

// Settings & logs
exports.getSettings = catchAsync(async (req, res) => ok(res, { settings: await admin.getSettings() }));
exports.updateSettings = catchAsync(async (req, res) => ok(res, { settings: await admin.updateSettings(actor(req), req.body || {}) }));
exports.listLogs = catchAsync(async (req, res) => ok(res, await admin.listLogs(req.query)));
