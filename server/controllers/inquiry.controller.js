const inquiryService = require('../services/inquiry.service');
const catchAsync = require('../utils/catchAsync');

exports.createInquiry = catchAsync(async (req, res) => {
  const { pgId, message, phone, visitDate } = req.body;
  const inquiry = await inquiryService.createInquiry(req.user._id, { pgId, message, phone, visitDate });
  res.status(201).json({ status: 'success', data: { inquiry } });
});

exports.getOwnerInquiries = catchAsync(async (req, res) => {
  const result = await inquiryService.getOwnerInquiries(req.user._id, req.query);
  res.status(200).json({ status: 'success', ...result });
});

exports.getStudentInquiries = catchAsync(async (req, res) => {
  const inquiries = await inquiryService.getStudentInquiries(req.user._id);
  res.status(200).json({ status: 'success', data: { inquiries } });
});

exports.updateStatus = catchAsync(async (req, res) => {
  const inquiry = await inquiryService.updateInquiryStatus(
    req.params.id,
    req.user._id,
    req.body.status
  );
  res.status(200).json({ status: 'success', data: { inquiry } });
});
