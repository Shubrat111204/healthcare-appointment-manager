const User = require('../models/User');
const SlotHold = require('../models/SlotHold');
const Appointment = require('../models/Appointment');
const { generateCandidateSlots } = require('../utils/generateSlots');

// GET /api/doctors?specialisation=Cardiology
exports.searchDoctors = async (req, res, next) => {
  try {
    const { specialisation } = req.query;
    const filter = { role: 'doctor', isActive: true };
    if (specialisation) {
      filter['doctorProfile.specialisation'] = new RegExp(specialisation, 'i');
    }
    const doctors = await User.find(filter).select('name email doctorProfile');
    res.json({ success: true, doctors });
  } catch (err) {
    next(err);
  }
};

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
exports.getAvailableSlots = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date query param (YYYY-MM-DD) is required' });

    const doctor = await User.findOne({ _id: id, role: 'doctor' });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const candidates = generateCandidateSlots(doctor.doctorProfile, date);
    if (candidates.length === 0) return res.json({ success: true, slots: [] });

    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59');

    const [booked, held] = await Promise.all([
      Appointment.find({
        doctorId: id,
        status: { $in: ['confirmed', 'completed'] },
        slotStart: { $gte: dayStart, $lte: dayEnd },
      }).select('slotStart'),
      SlotHold.find({
        doctorId: id,
        slotStart: { $gte: dayStart, $lte: dayEnd },
      }).select('slotStart'),
    ]);

    const taken = new Set([
      ...booked.map((b) => new Date(b.slotStart).getTime()),
      ...held.map((h) => new Date(h.slotStart).getTime()),
    ]);

    const slots = candidates
      .filter((c) => !taken.has(c.slotStart.getTime()))
      .map((c) => ({ slotStart: c.slotStart, slotEnd: c.slotEnd }));

    res.json({ success: true, slots });
  } catch (err) {
    next(err);
  }
};
