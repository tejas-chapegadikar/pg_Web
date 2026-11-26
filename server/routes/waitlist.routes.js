const express = require('express');
const rateLimit = require('express-rate-limit');
const waitlistController = require('../controllers/waitlist.controller');

const router = express.Router();

// Stops one script filling the list; loose enough for a whole hostel on one Wi-Fi
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: () => process.env.NODE_ENV === 'test',
  message: { status: 'fail', message: 'Too many tries. Please wait a few minutes.' },
});

router.post('/', joinLimiter, waitlistController.join);
router.get('/count', waitlistController.count);

module.exports = router;
