const WaitlistEntry = require('../models/WaitlistEntry');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** How many are waiting, split into students and PG owners / brokers */
const counts = async () => {
  const [students, owners] = await Promise.all([
    WaitlistEntry.countDocuments({ role: { $ne: 'owner' } }),
    WaitlistEntry.countDocuments({ role: 'owner' }),
  ]);
  return { count: students + owners, students, owners };
};

/** POST /api/waitlist — joining twice with the same email is fine, not an error */
exports.join = catchAsync(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new AppError('Enter a valid email address.', 400);
  }
  const role = req.body?.role === 'owner' ? 'owner' : 'student';

  // Joining again keeps one row and just updates the role they picked
  const result = await WaitlistEntry.updateOne({ email }, { $setOnInsert: { email }, $set: { role } }, { upsert: true });
  const alreadyJoined = result.upsertedCount === 0;

  res.status(alreadyJoined ? 200 : 201).json({ status: 'success', data: { alreadyJoined, ...(await counts()) } });
});

/** GET /api/waitlist/count — the big number on the page */
exports.count = catchAsync(async (req, res) => {
  res.status(200).json({ status: 'success', data: await counts() });
});
