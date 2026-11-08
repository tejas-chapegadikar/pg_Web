const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Protect routes — verifies access token from Authorization header
 */
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please login to access this resource.', 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  const user = await User.findById(decoded.id);

  if (!user) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  req.user = user;
  next();
});

/**
 * For pages open to everyone that show more to signed-in users. No token: carry on
 * as a visitor. A bad or expired token still gets a 401, so the client can refresh it.
 */
exports.optionalAuth = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return exports.protect(req, res, next);
};

/**
 * Restrict access to specific roles
 */
exports.restrictTo = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
