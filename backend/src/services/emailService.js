const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// Every send is logged first (status=pending), then updated to sent/failed.
// Failures never throw back to the caller — the retry job (jobs/emailRetryJob.js)
// picks up anything left in "failed" state.
async function sendEmail({ to, subject, html, type, relatedAppointment = null }) {
  const log = await EmailLog.create({ to, subject, html, type, relatedAppointment, status: 'pending' });
  try {
    await transporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    log.status = 'sent';
    log.sentAt = new Date();
    await log.save();
    return { success: true };
  } catch (err) {
    console.error('[emailService] send failed:', err.message);
    log.status = 'failed';
    log.lastError = err.message;
    await log.save();
    return { success: false, error: err.message };
  }
}

const templates = {
  bookingConfirmation: (name, doctorName, slotStart) => `
    <h2>Appointment Confirmed</h2>
    <p>Hi ${name},</p>
    <p>Your appointment with <b>Dr. ${doctorName}</b> is confirmed for
    <b>${new Date(slotStart).toLocaleString()}</b>.</p>
    <p>You'll receive a reminder before your visit. Please arrive 10 minutes early.</p>`,
  doctorBookingNotice: (doctorName, patientName, slotStart) => `
    <h2>New Appointment Booked</h2>
    <p>Hi Dr. ${doctorName},</p>
    <p>${patientName} has booked a slot on <b>${new Date(slotStart).toLocaleString()}</b>.
    Their pre-visit symptom summary will be available in your dashboard.</p>`,
  reminder: (name, doctorName, slotStart) => `
    <h2>Appointment Reminder</h2>
    <p>Hi ${name}, this is a reminder of your upcoming appointment with
    Dr. ${doctorName} at <b>${new Date(slotStart).toLocaleString()}</b>.</p>`,
  cancellation: (name, doctorName, slotStart, reason) => `
    <h2>Appointment Cancelled</h2>
    <p>Hi ${name},</p>
    <p>Your appointment with Dr. ${doctorName} on
    <b>${new Date(slotStart).toLocaleString()}</b> has been cancelled.</p>
    ${reason ? `<p>Reason: ${reason}</p>` : ''}
    <p>Please book a new slot at your convenience.</p>`,
  leaveNotice: (name, doctorName, slotStart) => `
    <h2>Doctor Unavailable — Please Reschedule</h2>
    <p>Hi ${name},</p>
    <p>Dr. ${doctorName} has marked leave for
    <b>${new Date(slotStart).toLocaleDateString()}</b>, so your appointment at
    ${new Date(slotStart).toLocaleTimeString()} has been cancelled. We're sorry
    for the inconvenience — please book a new slot.</p>`,
  postVisitSummary: (name, summary) => `
    <h2>Your Visit Summary</h2>
    <p>Hi ${name},</p>
    <p>${summary.summary}</p>
    <h3>Medication Schedule</h3>
    <p>${summary.medicationSchedule || 'No medication prescribed.'}</p>
    <h3>Follow-up</h3>
    <p>${summary.followUpSteps || 'No follow-up required.'}</p>`,
  medicationReminder: (name, medicationName, instructions) => `
    <h2>Medication Reminder</h2>
    <p>Hi ${name}, it's time to take <b>${medicationName}</b>.</p>
    <p>${instructions || ''}</p>`,
};

module.exports = { sendEmail, templates };
