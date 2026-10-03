const Inquiry = require('../models/Inquiry');
const PGListing = require('../models/PGListing');
const User = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * Send an inquiry on a PG listing
 */
exports.createInquiry = async (studentId, { pgId, message, phone, visitDate }) => {
  const pg = await PGListing.findById(pgId);
  if (!pg) throw new AppError('PG listing not found.', 404);

  const inquiry = await Inquiry.create({
    pg: pgId,
    student: studentId,
    owner: pg.owner,
    message,
    phone,
    visitDate: visitDate || undefined,
  });

  // Increment inquiry analytics
  await PGListing.findByIdAndUpdate(pgId, { $inc: { 'analytics.inquiries': 1 } });

  // Send inquiry notification to owner in the background
  try {
    const [ownerUser, studentUser] = await Promise.all([
      User.findById(pg.owner),
      User.findById(studentId),
    ]);

    if (ownerUser && ownerUser.email) {
      const emailService = require('./email.service');
      emailService.sendInquiryNotification({
        ownerEmail: ownerUser.email,
        ownerName: ownerUser.name,
        studentName: studentUser ? studentUser.name : 'A student',
        studentPhone: phone || (studentUser ? studentUser.phone : 'N/A'),
        pgTitle: pg.title,
        message,
        visitDate: inquiry.visitDate,
      }).catch(err => console.error('Failed to send inquiry notification email:', err));
    }
  } catch (err) {
    console.error('Failed to prepare inquiry notification email:', err);
  }

  return inquiry.populate(['student', 'pg']);
};

/**
 * Get all inquiries for the logged-in owner
 */
exports.getOwnerInquiries = async (ownerId, query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = 20;
  const skip = (page - 1) * limit;

  const filter = { owner: ownerId };
  if (query.status) filter.status = query.status;

  const [inquiries, total] = await Promise.all([
    Inquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('student', 'name email phone')
      .populate('pg', 'title location.city'),
    Inquiry.countDocuments(filter),
  ]);

  return { inquiries, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get all inquiries sent by the logged-in student
 */
exports.getStudentInquiries = async (studentId) => {
  return Inquiry.find({ student: studentId })
    .sort({ createdAt: -1 })
    .populate('pg', 'title location images rent')
    .populate('owner', 'name email');
};

/**
 * Update inquiry status (owner only)
 */
exports.updateInquiryStatus = async (inquiryId, ownerId, status) => {
  const inquiry = await Inquiry.findOneAndUpdate(
    { _id: inquiryId, owner: ownerId },
    { status },
    { new: true, runValidators: true }
  );
  if (!inquiry) throw new AppError('Inquiry not found or not authorized.', 404);
  return inquiry;
};
