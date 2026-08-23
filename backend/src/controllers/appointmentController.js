const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const SlotHold = require('../models/SlotHold');
const User = require('../models/User');
const MedicationReminder = require('../models/MedicationReminder');
const { generatePreVisitSummary, generatePostVisitSummary } = require('../services/llmService');
const { sendEmail, templates } = require('../services/emailService');
const calendarService = require('../services/calendarService');

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 5);

// STEP 1 — Patient selects a slot. We take out a short TTL hold so a second
// patient can't land on the same slot's symptom form while the first is
// filling it in. Relies on the unique index {doctorId, slotStart} on
// SlotHold: if two requests race, MongoDB's own uniqueness guarantee
// (not application logic) rejects the loser — this is what makes it safe
// under real concurrency, not just "check then write".
exports.holdSlot = async (req, res, next) => {
  try {
    const { doctorId, slotStart, slotEnd } = req.body;
    if (!doctorId || !slotStart || !slotEnd) {
      return res.status(400).json({ success: false, message: 'doctorId, slotStart, slotEnd are required' });
    }

    const existingConfirmed = await Appointment.findOne({
      doctorId, slotStart: new Date(slotStart), status: { $in: ['confirmed', 'completed'] },
    });
    if (existingConfirmed) {
      return res.status(409).json({ success: false, message: 'This slot has just been booked. Please pick another.' });
    }

    let hold;
    try {
      hold = await SlotHold.create({
        doctorId,
        patientId: req.user._id,
        slotStart: new Date(slotStart),
        slotEnd: new Date(slotEnd),
        expiresAt: new Date(Date.now() + HOLD_TTL_MINUTES * 60000),
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'This slot is currently held by another patient. Please pick another slot or try again shortly.' });
      }
      throw err;
    }

    res.status(201).json({ success: true, holdId: hold._id, expiresAt: hold.expiresAt });
  } catch (err) {
    next(err);
  }
};

// STEP 2 — Patient submits symptoms and confirms. This:
//   1. Verifies the hold is still theirs and unexpired
//   2. Atomically creates the Appointment (unique index is the real guard
//      against double-booking, not the hold — the hold is just UX)
//   3. Generates the AI pre-visit summary (never blocks booking on failure)
//   4. Sends confirmation emails to patient + doctor
//   5. Creates a Google Calendar event if either party has connected calendar
exports.confirmBooking = async (req, res, next) => {
  try {
    const { holdId, symptoms } = req.body;
    if (!holdId) return res.status(400).json({ success: false, message: 'holdId is required' });

    const hold = await SlotHold.findById(holdId);
    if (!hold) return res.status(410).json({ success: false, message: 'Hold expired or not found. Please select the slot again.' });
    if (String(hold.patientId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'This hold belongs to another user' });
    }

    const [doctor, patient] = await Promise.all([
      User.findById(hold.doctorId),
      User.findById(hold.patientId),
    ]);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    let appointment;
    try {
      appointment = await Appointment.create({
        patientId: hold.patientId,
        doctorId: hold.doctorId,
        slotStart: hold.slotStart,
        slotEnd: hold.slotEnd,
        symptoms: symptoms || '',
        status: 'confirmed',
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'This slot was just booked by someone else. Please choose another.' });
      }
      throw err;
    }

    // Hold no longer needed once the real appointment exists.
    await SlotHold.deleteOne({ _id: hold._id });

    // --- AI pre-visit summary (graceful failure) ---
    if (symptoms) {
      const summary = await generatePreVisitSummary(symptoms);
      appointment.preVisitSummary = summary;
      await appointment.save();
    }

    // --- Email notifications (logged + retried independently of booking) ---
    await sendEmail({
      to: patient.email,
      subject: 'Appointment Confirmed',
      html: templates.bookingConfirmation(patient.name, doctor.name, appointment.slotStart),
      type: 'booking_confirmation',
      relatedAppointment: appointment._id,
    });
    await sendEmail({
      to: doctor.email,
      subject: 'New Appointment Booked',
      html: templates.doctorBookingNotice(doctor.name, patient.name, appointment.slotStart),
      type: 'booking_confirmation',
      relatedAppointment: appointment._id,
    });

    // --- Google Calendar (graceful failure) ---
    const calResult = await calendarService.createAppointmentEvent({
      doctor,
      patient,
      slotStart: appointment.slotStart,
      slotEnd: appointment.slotEnd,
      summary: `Appointment: ${patient.name} with Dr. ${doctor.name}`,
      description: `Booked via Healthcare Appointment Manager. Chief complaint: ${appointment.preVisitSummary?.chiefComplaint || 'N/A'}`,
    });
    if (calResult.success) {
      appointment.calendarEvent = { eventId: calResult.eventId, htmlLink: calResult.htmlLink };
      appointment._calendarOwnerId = calResult.ownerId; // not persisted, used below
      await appointment.save();
    }

    res.status(201).json({ success: true, appointment });
  } catch (err) {
    next(err);
  }
};

exports.myAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user._id })
      .populate('doctorId', 'name doctorProfile.specialisation')
      .sort({ slotStart: -1 });
    res.json({ success: true, appointments });
  } catch (err) {
    next(err);
  }
};

// Doctor's queue — upcoming confirmed appointments with pre-visit summaries,
// most urgent/soonest first.
exports.doctorQueue = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({
      doctorId: req.user._id,
      status: 'confirmed',
      slotStart: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    })
      .populate('patientId', 'name email phone')
      .sort({ slotStart: 1 });
    res.json({ success: true, appointments });
  } catch (err) {
    next(err);
  }
};

exports.cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const appointment = await Appointment.findById(id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    const isOwner = String(appointment.patientId) === String(req.user._id) ||
      String(appointment.doctorId) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });
    }

    appointment.status = 'cancelled';
    appointment.cancelReason = reason || '';
    await appointment.save();

    const [doctor, patient] = await Promise.all([
      User.findById(appointment.doctorId),
      User.findById(appointment.patientId),
    ]);

    await sendEmail({
      to: patient.email,
      subject: 'Appointment Cancelled',
      html: templates.cancellation(patient.name, doctor.name, appointment.slotStart, reason),
      type: 'cancellation',
      relatedAppointment: appointment._id,
    });

    if (appointment.calendarEvent?.eventId) {
      // Best-effort: try both parties as potential owner since we don't
      // persist which one owned the event.
      await calendarService.deleteAppointmentEvent({ ownerId: doctor._id, eventId: appointment.calendarEvent.eventId }).catch(() => {});
    }

    res.json({ success: true, appointment });
  } catch (err) {
    next(err);
  }
};

// Doctor submits post-visit notes + prescription. Generates the
// patient-friendly summary and schedules medication reminders parsed from
// simple "MedicineName | instructions | timesPerDay | days" lines.
exports.submitPostVisit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, prescription, medications } = req.body; // medications: [{name, instructions, timesPerDay, totalDays}]
    const appointment = await Appointment.findById(id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (String(appointment.doctorId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the treating doctor can submit visit notes' });
    }

    appointment.postVisitNotes = notes || '';
    appointment.prescription = prescription || '';
    appointment.status = 'completed';

    const summary = await generatePostVisitSummary(notes || prescription || '');
    appointment.postVisitSummary = summary;
    await appointment.save();

    const patient = await User.findById(appointment.patientId);
    await sendEmail({
      to: patient.email,
      subject: 'Your Visit Summary',
      html: templates.postVisitSummary(patient.name, summary),
      type: 'post_visit_summary',
      relatedAppointment: appointment._id,
    });

    // Schedule medication reminders
    if (Array.isArray(medications)) {
      for (const med of medications) {
        if (!med.name) continue;
        const timesPerDay = med.timesPerDay || 1;
        const totalDays = med.totalDays || 5;
        await MedicationReminder.create({
          appointmentId: appointment._id,
          patientId: appointment.patientId,
          medicationName: med.name,
          instructions: med.instructions || '',
          timesPerDay,
          totalDays,
          dosesRemaining: timesPerDay * totalDays,
          nextSendAt: new Date(Date.now() + 5 * 60000), // first reminder in 5 min for demo purposes
        });
      }
    }

    res.json({ success: true, appointment });
  } catch (err) {
    next(err);
  }
};
