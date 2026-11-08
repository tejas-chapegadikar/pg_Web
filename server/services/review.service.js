const Review = require('../models/Review');
const PGListing = require('../models/PGListing');
const AppError = require('../utils/AppError');

exports.addOrUpdateReview = async (pgId, userId, { rating, comment }) => {
  const pg = await PGListing.findById(pgId);
  if (!pg) throw new AppError('PG listing not found', 404);

  // Upsert review
  const review = await Review.findOneAndUpdate(
    { pg: pgId, user: userId },
    { rating, comment },
    { returnDocument: 'after', upsert: true, runValidators: true }
  ).populate('user', 'name avatar');

  // Trigger recalculation on model
  await Review.calcAverageRatings(pg._id);

  return review;
};

exports.getPGReviews = async (pgId, query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ pg: pgId })
    .populate('user', 'name avatar')
    .sort('-createdAt')
    .skip(skip)
    .limit(limit);

  const total = await Review.countDocuments({ pg: pgId });

  // Calculate rating counts per star rating (1..5)
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const allPgReviews = await Review.find({ pg: pgId }).select('rating');
  allPgReviews.forEach((r) => {
    if (ratingDistribution[r.rating] !== undefined) {
      ratingDistribution[r.rating] += 1;
    }
  });

  return {
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    ratingDistribution,
  };
};

exports.deleteReview = async (reviewId, userId) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError('Review not found', 404);

  // Check ownership
  if (review.user.toString() !== userId.toString()) {
    throw new AppError('Not authorized to delete this review', 403);
  }

  const pgId = review.pg;
  await review.deleteOne();
  await Review.calcAverageRatings(pgId);

  return true;
};
