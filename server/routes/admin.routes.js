const express = require('express');
const router = express.Router();
const c = require('../controllers/admin.controller');
const { protect, requireAdmin } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');

// Every admin route: signed in, and an admin according to the server. Nothing here trusts the browser.
router.use(protect, requireAdmin());
// Admin data is private: never cache it in a browser or CDN
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/me', c.me);
router.get('/overview', c.overview);
router.get('/analytics', c.analytics);

router.get('/properties', c.listProperties);
router.post('/properties', c.createProperty);
router.get('/properties/:id', c.getProperty);
router.patch('/properties/:id', c.updateProperty);
router.post('/properties/:id/status', c.setPropertyStatus);
router.delete('/properties/:id', c.deleteProperty);
router.post('/properties/:id/images', handleUploadErrors(upload.array('images', 10)), c.uploadImages);
router.put('/properties/:id/images/order', c.reorderImages);
router.delete('/properties/:id/images/:publicId', c.deleteImage);

router.get('/waitlist', c.listWaitlist);
router.get('/waitlist/export', c.exportWaitlist);
router.get('/waitlist/:id', c.getWaitlistEntry);
router.patch('/waitlist/:id', c.updateWaitlistEntry);
router.post('/waitlist/:id/notes', c.addWaitlistNote);

router.get('/users', c.listUsers);
router.get('/users/:id', c.getUser);
router.patch('/users/:id', c.updateUser);

router.get('/settings', c.getSettings);
router.patch('/settings', c.updateSettings);

// Read-only: there is deliberately no route to edit or delete a log entry
router.get('/logs', c.listLogs);

module.exports = router;
