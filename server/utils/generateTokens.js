const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT access token
 */
const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
  });

/**
 * Generate a signed JWT refresh token
 */
const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    jwtid: crypto.randomUUID(), // two sessions started in the same second must still differ
  });

/**
 * Attach refresh token as httpOnly cookie
 */
const sendRefreshTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

module.exports = { generateAccessToken, generateRefreshToken, sendRefreshTokenCookie };
