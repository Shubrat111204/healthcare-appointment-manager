const mongoose = require('mongoose');

const workingHourSchema = new mongoose.Schema({
  day: { type: Number, min: 0, max: 6, required: true }, // 0=Sunday ... 6=Saturday
  start: { type: String, required: true }, // "09:00"
  end: { type: String, required: true },   // "17:00"
}, { _id: false });

const doctorProfileSchema = new mongoose.Schema({
  specialisation: { type: String, required: true },
  bio: { type: String, default: '' },
  slotDurationMinutes: { type: Number, default: 30 },
  workingHours: { type: [workingHourSchema], default: [] },
  leaveDays: { type: [Date], default: [] }, // whole-day leave dates
}, { _id: false });

const googleCalendarSchema = new mongoose.Schema({
  connected: { type: Boolean, default: false },
  refreshToken: { type: String, default: null },
  calendarId: { type: String, default: 'primary' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, default: '' },
  role: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
  doctorProfile: { type: doctorProfileSchema, default: undefined },
  googleCalendar: { type: googleCalendarSchema, default: () => ({}) },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
