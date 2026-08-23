const mongoose = require('mongoose');

// One document per medication line item parsed from a prescription.
// The background job wakes up on a schedule, finds due reminders, emails
// the patient, and advances nextSendAt / decrements dosesRemaining.
const medicationReminderSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicationName: { type: String, required: true },
  instructions: { type: String, default: '' },
  timesPerDay: { type: Number, default: 1 },
  totalDays: { type: Number, default: 5 },
  dosesRemaining: { type: Number, required: true },
  nextSendAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

medicationReminderSchema.index({ active: 1, nextSendAt: 1 });

module.exports = mongoose.model('MedicationReminder', medicationReminderSchema);
