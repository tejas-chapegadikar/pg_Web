require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// The reason in plain words for GET /api/health, without repeating the link or password
const describeDbError = (err) => {
  const msg = String(err?.message || '');
  if (!MONGO_URI) return 'MONGO_URI is not set';
  if (/[<>]/.test(MONGO_URI)) return 'MONGO_URI still has < > in it — replace <db_username> and <db_password> with your own';
  const symbolsInPassword = MONGO_URI.split('@').length > 2 || /unescaped|malformed/i.test(msg);
  if (symbolsInPassword) return 'the password in MONGO_URI has symbols like @ : / ? # % — use letters and numbers only';
  if (/bad auth|authentication failed/i.test(msg)) return 'wrong database username or password in MONGO_URI';
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) return 'the database address in MONGO_URI was not found';
  if (/whitelist|timed out|ECONNREFUSED|ETIMEDOUT/i.test(msg)) return 'could not reach the database — in MongoDB Atlas, Network Access must allow 0.0.0.0/0';
  if (/scheme|connection string|must be a string|URI/i.test(msg)) return 'MONGO_URI is not a valid mongodb+srv:// link';
  return 'could not connect to the database';
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    // On Vercel, exiting fails every request (even /api/health) with a bare 500;
    // keep serving so the health check can say what's wrong
    if (!process.env.VERCEL) process.exit(1);
    app.locals.dbProblem = describeDbError(err);
  }
};

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT} [${process.env.NODE_ENV}]`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await mongoose.connection.close();
      console.log('💤 Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION 💥', err.message);
    server.close(() => process.exit(1));
  });
};

startServer();
