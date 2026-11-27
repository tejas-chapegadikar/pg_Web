const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { adminRoleOf } = require('../utils/adminAccess');

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
  if (user.isSuspended) {
    return next(new AppError('This account has been suspended. Contact the anieghar team for help.', 403));
  }

  req.user = user;
  next();
});

/**
 * Admin panel only. Use after `protect`. With roles given, only those admin roles pass.
 * Sets req.adminRole ('founder' | 'cofounder').
 */
exports.requireAdmin = (...roles) =>
  (req, res, next) => {
    const role = adminRoleOf(req.user);
    if (!role || (roles.length && !roles.includes(role))) {
      return next(new AppError('You do not have access to the admin panel.', 403));
    }
    req.adminRole = role;
    next();
  };

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
