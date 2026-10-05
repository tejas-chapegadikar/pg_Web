const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middleware/errorHandler');
const UPLOADS_DIR = require('./utils/uploadsDir');
const AppError = require('./utils/AppError');

// Route imports
const authRoutes = require('./routes/auth.routes');
const pgRoutes = require('./routes/pg.routes');
const inquiryRoutes = require('./routes/inquiry.routes');
const savesRoutes = require('./routes/saves.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reviewRoutes = require('./routes/review.routes');
const chatbotRoutes = require('./routes/chatbot.routes');

const app = express();

app.set('trust proxy', 1);

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());

// Listing photos saved on disk when Cloudinary isn't configured (local development).
// Mounted before the rate limiter so a page full of photos doesn't use up the API quota.
app.use('/api/uploads', express.static(UPLOADS_DIR, { maxAge: '7d', fallthrough: false }));

// Test suites make many requests in a burst; limits still apply everywhere else
const skipInTests = () => process.env.NODE_ENV === 'test';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: skipInTests,
  message: { status: 'fail', message: 'Too many auth attempts. Please try again in 15 minutes.' },
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────
// Use 'dev' format locally, 'combined' (Apache-style) in production for Vercel logs
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/pg', pgRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/saves', savesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chatbot', chatbotRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new AppError(`Cannot find ${req.method} ${req.originalUrl} on this server.`, 404));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
