const router = require('express').Router();
const { connect, oauthCallback } = require('../controllers/calendarController');
const { protect } = require('../middleware/auth');

router.get('/oauth/connect', protect, connect);
router.get('/oauth/callback', oauthCallback); // Google redirects here without auth header, hence `state`

module.exports = router;
