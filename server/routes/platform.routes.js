const express = require('express');
const PlatformSetting = require('../models/PlatformSetting');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

/** GET /api/platform — what the website needs to know before it draws anything (public, no private data) */
router.get(
  '/',
  catchAsync(async (req, res) => {
    const s = await PlatformSetting.get();
    // Short cache so a mode change shows up within a few seconds
    res.set('Cache-Control', 'no-cache');
    res.status(200).json({
      status: 'success',
      data: {
        mode: s.mode,
        announcement: s.announcement,
        waitlistMessage: s.waitlistMessage,
        maintenanceMessage: s.maintenanceMessage,
        propertyTypes: s.propertyTypes,
        cities: s.cities,
      },
    });
  })
);

module.exports = router;
