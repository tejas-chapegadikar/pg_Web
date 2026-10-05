const crypto = require('crypto');
const User = require('../models/User');
const OtpCode = require('../models/OtpCode');
const AppError = require('../utils/AppError');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../utils/generateTokens');
const jwt = require('jsonwebtoken');

const ROLES = ['student', 'owner'];
const PURPOSES = ['login', 'signup'];
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Start a session: new access + refresh token, refresh token stored for rotation */
const issueTokens = async (user) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { user, accessToken, refreshToken };
};

const assertPurpose = (purpose) => {
  if (!PURPOSES.includes(purpose)) throw new AppError('Invalid request.', 400);
};

/** New accounts made through Google / phone pick their role on the sign-up form */
const assertRole = (role) => {
  if (!ROLES.includes(role)) throw new AppError('Choose whether you are a student or a broker.', 400);
};

// ── Email check at sign-up ────────────────────────────────────────────────────
// An email/password account is only created once the person types in the
// 6-digit code we emailed to that address, so every account has a real inbox.

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_MS = 30 * 1000;
const CODE_MAX_TRIES = 5;

// Keyed HMAC so a leaked database doesn't let anyone brute-force the 6-digit codes
const hashCode = (code) =>
  crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET).update(String(code)).digest('hex');

const normaliseEmail = (email) => {
  const value = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(value)) throw new AppError('Enter a valid email address.', 400);
  return value;
};

/** Check the emailed code and use it up. Every try counts, wrong or right. */
const consumeSignupCode = async (email, code) => {
  if (!/^\d{6}$/.test(String(code ?? ''))) throw new AppError('Enter the 6-digit code we emailed you.', 400);

  // Count the try before comparing, in one atomic step, so parallel guesses can't get around the limit.
  // timestamps: false keeps updatedAt as the send time, which the resend wait is measured from.
  const record = await OtpCode.findOneAndUpdate(
    { email, purpose: 'signup', expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after', timestamps: false }
  );
  if (!record) throw new AppError('This code has expired. Ask for a new one.', 400);
  if (record.attempts > CODE_MAX_TRIES) {
    await record.deleteOne();
    throw new AppError('Too many wrong tries. Ask for a new code.', 429);
  }
  if (!crypto.timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(record.codeHash))) {
    throw new AppError('That code isn’t right. Check it and try again.', 400);
  }
  await record.deleteOne();
};

/**
 * Sign-up step 1: email a 6-digit code to the address on the form. Returns the code
 * so the controller can show it on screen in local development without an email server.
 */
exports.sendEmailOtp = async ({ email: rawEmail }) => {
  const email = normaliseEmail(rawEmail);
  if (await User.findOne({ email })) {
    throw new AppError('An account with this email already exists. Sign in instead.', 409);
  }

  const existing = await OtpCode.findOne({ email, purpose: 'signup' });
  if (existing && Date.now() - existing.updatedAt.getTime() < CODE_RESEND_MS) {
    throw new AppError('A code was just sent. Wait a few seconds before asking for another.', 429);
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await OtpCode.findOneAndUpdate(
    { email, purpose: 'signup' },
    { codeHash: hashCode(code), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const emailService = require('./email.service');
  try {
    await emailService.sendOtpEmail({ to: email, code });
  } catch {
    throw new AppError('We couldn’t send the email right now. Please try again.', 502);
  }

  return { code };
};

/**
 * Sign-up step 2: create the email/password account, using the code from step 1.
 */
exports.register = async ({ name, email: rawEmail, password, role, phone, code }) => {
  const email = normaliseEmail(rawEmail);
  if (await User.findOne({ email })) {
    throw new AppError('An account with this email already exists. Sign in instead.', 409);
  }
  if (!name?.trim()) throw new AppError('Please tell us your name.', 400);
  if (!password) throw new AppError('Choose a password.', 400);

  const user = new User({
    name: name.trim(),
    email,
    password,
    role,
    phone: phone || undefined,
    emailVerified: true,
    isOnboarded: false, // triggers onboarding modal on client
  });
  // Check every detail before using up the code, so a typo doesn't mean waiting for a new email
  await user.validate();
  await consumeSignupCode(email, code);
  await user.save();

  return issueTokens(user);
};

/**
 * Login an existing user (email/password)
 */
exports.login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  // Accounts made with Google have no password (bcrypt would throw)
  if (user && !user.password) {
    throw new AppError('This account uses Google sign-in. Choose “Continue with Google” instead.', 401);
  }
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password.', 401);
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { user, accessToken, refreshToken };
};

/**
 * Phone OTP via Firebase: the client verifies the SMS code with Firebase and
 * sends us the resulting ID token.
 *
 * purpose 'login'  → account must exist
 * purpose 'signup' → account must not exist; name + role come from the form
 * no purpose       → legacy clients: sign in or create a bare account (onboarding fills the rest)
 */
exports.phoneLogin = async ({ idToken, purpose, name, role }) => {
  if (purpose !== undefined) assertPurpose(purpose);
  if (purpose === 'signup') {
    if (!name?.trim()) throw new AppError('Please tell us your name.', 400);
    assertRole(role);
  }

  const { verifyFirebaseIdToken } = require('./firebaseAdmin');
  const { uid, phone_number: phone } = await verifyFirebaseIdToken(idToken);
  if (!phone) throw new AppError('Phone number not found in token.', 400);

  // Older accounts may have saved the number without the +91 prefix
  let user =
    (await User.findOne({ firebaseUid: uid })) ||
    (await User.findOne({ phone: { $in: [phone, phone.replace(/^\+91/, '')] } }));

  if (purpose === 'login' && !user) {
    throw new AppError('No account found with this number. Create one first.', 404);
  }
  if (purpose === 'signup' && user) {
    throw new AppError('An account with this number already exists. Sign in instead.', 409);
  }

  const isNewUser = !user;
  if (user) {
    if (user.firebaseUid !== uid || !user.phoneVerified) {
      user.firebaseUid = uid;
      user.phoneVerified = true;
    }
  } else {
    user = await User.create({
      firebaseUid: uid,
      phone,
      phoneVerified: true,
      name: purpose === 'signup' ? name.trim() : '',
      role: purpose === 'signup' ? role : 'student',
      // A sign-up form already gave us name, role and phone — nothing left to onboard
      isOnboarded: purpose === 'signup',
    });
  }

  return { ...(await issueTokens(user)), isNewUser };
};

/**
 * Google sign-in via Firebase. Signs in the account with the same (Google-verified)
 * email, or creates one with the role picked on the form.
 */
exports.googleLogin = async ({ idToken, role }) => {
  const { verifyFirebaseIdToken } = require('./firebaseAdmin');
  const decoded = await verifyFirebaseIdToken(idToken);

  if (decoded.firebase?.sign_in_provider !== 'google.com') {
    throw new AppError('That wasn’t a Google sign-in.', 400);
  }
  const email = decoded.email?.toLowerCase();
  if (!email || !decoded.email_verified) {
    throw new AppError('Your Google account doesn’t have a verified email.', 400);
  }

  let user = await User.findOne({ email });
  const isNewUser = !user;
  if (user) {
    if (!user.avatar && decoded.picture) user.avatar = decoded.picture;
    user.emailVerified = true; // Google just proved they own this inbox
  } else {
    assertRole(role);
    user = await User.create({
      name: (decoded.name || email.split('@')[0]).slice(0, 60),
      email,
      emailVerified: true,
      role,
      avatar: decoded.picture || '',
      isOnboarded: false, // onboarding asks for a phone number
    });
  }

  return { ...(await issueTokens(user)), isNewUser };
};

/**
 * Update user profile (used during onboarding)
 */
exports.updateProfile = async (userId, { name, role, phone }) => {
  const updateData = { isOnboarded: true };
  if (name !== undefined) updateData.name = name;
  if (role !== undefined) updateData.role = role;
  if (phone !== undefined) {
    updateData.phone = phone;
  }

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!user) throw new AppError('User not found.', 404);
  return user;
};

/**
 * Refresh access token using refresh token from cookie
 */
exports.refreshToken = async (token) => {
  if (!token) throw new AppError('No refresh token provided.', 401);

  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id).select('+refreshToken');

  if (!user || user.refreshToken !== token) {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

/**
 * Logout — clear refresh token
 */
exports.logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: '' });
};

/**
 * Forgot password - generate reset token and send email
 */
exports.forgotPassword = async (email) => {
  const crypto = require('crypto');
  if (!email) throw new AppError('Please provide an email address.', 400);

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('No account found with this email.', 404);
  }

  // Generate a random reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash the token and set it to user document with expiration (1 hour)
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 3600000; // 1 hour

  await user.save({ validateBeforeSave: false });

  // Send email
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
  
  const emailService = require('./email.service');
  await emailService.sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
  });

  return resetToken;
};

/**
 * Reset password - verify token and update password
 */
exports.resetPassword = async (token, password) => {
  const crypto = require('crypto');
  if (!token) throw new AppError('Reset token is required.', 400);
  if (!password) throw new AppError('Please provide a new password.', 400);

  // Hash token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find user with matching token and valid expiry
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new AppError('Reset link is invalid or has expired.', 400);
  }

  // Update password and clear reset token fields
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save(); // will trigger pre('save') hash
  return user;
};
