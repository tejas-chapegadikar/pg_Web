const authService = require('../services/auth.service');
const catchAsync = require('../utils/catchAsync');
const { sendRefreshTokenCookie } = require('../utils/generateTokens');

// Needs the 6-digit code that POST /otp/send emailed to this address
exports.register = catchAsync(async (req, res) => {
  const { name, email, password, role, phone, code } = req.body;
  const { user, accessToken, refreshToken } = await authService.register({
    name, email, password, role, phone, code,
  });

  sendRefreshTokenCookie(res, refreshToken);

  res.status(201).json({
    status: 'success',
    data: { user, accessToken },
  });
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login({ email, password });

  sendRefreshTokenCookie(res, refreshToken);

  res.status(200).json({
    status: 'success',
    data: { user, accessToken },
  });
});

exports.phoneLogin = catchAsync(async (req, res) => {
  const { idToken, purpose, name, role } = req.body;
  if (!idToken) {
    return res.status(400).json({ status: 'fail', message: 'idToken is required.' });
  }

  const { user, accessToken, refreshToken, isNewUser } = await authService.phoneLogin({ idToken, purpose, name, role });

  sendRefreshTokenCookie(res, refreshToken);

  res.status(isNewUser ? 201 : 200).json({
    status: 'success',
    data: { user, accessToken },
  });
});

exports.googleLogin = catchAsync(async (req, res) => {
  const { idToken, role } = req.body;
  const { user, accessToken, refreshToken, isNewUser } = await authService.googleLogin({ idToken, role });

  sendRefreshTokenCookie(res, refreshToken);

  res.status(isNewUser ? 201 : 200).json({
    status: 'success',
    data: { user, accessToken },
  });
});

/**
 * Locally, before an email server is set up, the code can be shown on screen.
 * Needs all three: not production, no SMTP settings, and OTP_DEV_ECHO=true in server/.env.
 */
const shouldShowCodeOnScreen = () =>
  process.env.NODE_ENV !== 'production' &&
  process.env.OTP_DEV_ECHO === 'true' &&
  !require('../services/email.service').isEmailConfigured();

/** Sign-up step 1: email a code to confirm the address (step 2 is POST /register) */
exports.sendOtp = catchAsync(async (req, res) => {
  const { code } = await authService.sendEmailOtp({ email: req.body.email });

  res.status(200).json({
    status: 'success',
    message: 'Code sent.',
    ...(shouldShowCodeOnScreen() ? { devCode: code } : {}),
  });
});

exports.updateProfile = catchAsync(async (req, res) => {
  const { name, role, phone } = req.body;
  const user = await authService.updateProfile(req.user._id, { name, role, phone });

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

exports.refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken;
  const { user, accessToken, refreshToken } = await authService.refreshToken(token);

  sendRefreshTokenCookie(res, refreshToken);

  res.status(200).json({
    status: 'success',
    data: { user, accessToken },
  });
});

exports.logout = catchAsync(async (req, res) => {
  await authService.logout(req.user._id);
  res.clearCookie('refreshToken');
  res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
});

exports.getMe = catchAsync(async (req, res) => {
  res.status(200).json({ status: 'success', data: { user: req.user } });
});

exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  await authService.forgotPassword(email);
  res.status(200).json({
    status: 'success',
    message: 'Password reset link sent to email.',
  });
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  await authService.resetPassword(token, password);
  res.status(200).json({
    status: 'success',
    message: 'Password reset successful.',
  });
});
