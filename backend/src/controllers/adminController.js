const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const { sendEmail, templates } = require('../services/emailService');
const calendarService = require('../services/calendarService');

function tempPassword() {
  return crypto.randomBytes(6).toString('hex');
}

// Admin provisions doctor accounts + profile in one step.
exports.createDoctor = async (req, res, next) => {
  try {
    const { name, email, phone, specialisation, bio, slotDurationMinutes, workingHours } = req.body;
    if (!name || !email || !specialisation || !workingHours) {
      return res.status(400).json({ success: false, message: 'name, email, specialisation, workingHours are required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });

    const rawPassword = tempPassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const doctor = await User.create({
      name, email, phone, passwordHash, role: 'doctor',
      doctorProfile: { specialisation, bio, slotDurationMinutes: slotDurationMinutes || 30, workingHours, leaveDays: [] },
    });

    await sendEmail({
      to: email,
      subject: 'Your Clinic Portal Account',
      html: `<p>Hi Dr. ${name},</p><p>An account has been created for you.</p>
             <p>Email: ${email}<br/>Temporary Password: <b>${rawPassword}</b></p>
             <p>Please log in and change your password.</p>`,
      type: 'booking_confirmation',
    });

    res.status(201).json({ success: true, doctor: { id: doctor._id, name, email, doctorProfile: doctor.doctorProfile } });
  } catch (err) {
    next(err);
  }
};

exports.updateDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { specialisation, bio, slotDurationMinutes, workingHours, isActive } = req.body;
    const doctor = await User.findOne({ _id: id, role: 'doctor' });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    if (specialisation !== undefined) doctor.doctorProfile.specialisation = specialisation;
    if (bio !== undefined) doctor.doctorProfile.bio = bio;
    if (slotDurationMinutes !== undefined) doctor.doctorProfile.slotDurationMinutes = slotDurationMinutes;
    if (workingHours !== undefined) doctor.doctorProfile.workingHours = workingHours;
    if (isActive !== undefined) doctor.isActive = isActive;

    await doctor.save();
    res.json({ success: true, doctor });
  } catch (err) {
    next(err);
  }
};

exports.listDoctors = async (req, res, next) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('-passwordHash');
    res.json({ success: true, doctors });
  } catch (err) {
    next(err);
  }
};

// Marks a date as leave for a doctor. Any existing confirmed appointments
// that day are cancelled and both patient + doctor are notified by email;
// the calendar event (if any) is deleted so it doesn't linger on anyone's
// calendar.
exports.addLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.body; // YYYY-MM-DD
    if (!date) return res.status(400).json({ success: false, message: 'date is required' });

    const doctor = await User.findOne({ _id: id, role: 'doctor' });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    doctor.doctorProfile.leaveDays.push(new Date(date + 'T00:00:00'));
    await doctor.save();

    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59');
    const affected = await Appointment.find({
      doctorId: id,
      status: 'confirmed',
      slotStart: { $gte: dayStart, $lte: dayEnd },
    }).populate('patientId', 'name email');

    const results = [];
    for (const appt of affected) {
      appt.status = 'cancelled_by_leave';
      appt.cancelReason = 'Doctor on leave';
      await appt.save();

      await sendEmail({
        to: appt.patientId.email,
        subject: 'Your Appointment Has Been Cancelled — Doctor on Leave',
        html: templates.leaveNotice(appt.patientId.name, doctor.name, appt.slotStart),
        type: 'leave_notice',
        relatedAppointment: appt._id,
      });

      if (appt.calendarEvent?.eventId) {
        await calendarService.deleteAppointmentEvent({ ownerId: doctor._id, eventId: appt.calendarEvent.eventId }).catch(() => {});
      }
      results.push({ appointmentId: appt._id, patientEmail: appt.patientId.email });
    }

    res.json({ success: true, leaveDate: date, affectedCount: results.length, affected: results });
  } catch (err) {
    next(err);
  }
};

exports.allAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find()
      .populate('patientId', 'name email')
      .populate('doctorId', 'name doctorProfile.specialisation')
      .sort({ slotStart: -1 })
      .limit(200);
    res.json({ success: true, appointments });
  } catch (err) {
    next(err);
  }
};
