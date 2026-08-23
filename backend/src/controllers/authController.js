const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function publicUser(user) {
  const { _id, name, email, role, phone, doctorProfile, googleCalendar } = user;
  return { id: _id, name, email, role, phone, doctorProfile, calendarConnected: googleCalendar?.connected || false };
}

// Public self-registration — patients only. Doctor/admin accounts are
// provisioned by an admin (see adminController.createDoctor) so that
// specialisation/working hours are set correctly from day one.
exports.registerPatient = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, password are required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, phone, role: 'patient' });
    const token = signToken(user);
    res.status(201).json({ success: true, token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ success: true, token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
};
