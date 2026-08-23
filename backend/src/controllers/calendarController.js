const User = require('../models/User');
const calendarService = require('../services/calendarService');
const jwt = require('jsonwebtoken');

// Returns a Google consent URL. We encode the requesting user's id in
// `state` (signed) so the callback knows whose account to attach the
// refresh token to, without requiring the browser to send auth headers
// during the OAuth redirect dance.
exports.connect = async (req, res, next) => {
  try {
    const state = jwt.sign({ userId: req.user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = calendarService.getAuthUrl(state);
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
};

exports.oauthCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    const tokens = await calendarService.exchangeCodeForTokens(code);

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).send('User not found');

    user.googleCalendar.connected = true;
    user.googleCalendar.refreshToken = tokens.refresh_token || user.googleCalendar.refreshToken;
    await user.save();

    res.redirect(`${process.env.CLIENT_URL}/calendar-connected`);
  } catch (err) {
    next(err);
  }
};
