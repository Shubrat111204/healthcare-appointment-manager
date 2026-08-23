const mongoose = require('mongoose');

// Every outbound email is logged here first. The background retry job
// scans for status="failed" and retries with backoff, so a transient SMTP
// outage never silently drops a confirmation/reminder.
const emailLogSchema = new mongoose.Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  type: {
    type: String,
    enum: ['booking_confirmation', 'reminder', 'cancellation', 'medication_reminder', 'leave_notice', 'post_visit_summary'],
    required: true,
  },
  relatedAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  retryCount: { type: Number, default: 0 },
  lastError: { type: String, default: '' },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('EmailLog', emailLogSchema);
