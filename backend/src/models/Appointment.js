const mongoose = require('mongoose');

const preVisitSummarySchema = new mongoose.Schema({
  urgency: { type: String, enum: ['Low', 'Medium', 'High', 'Unknown'], default: 'Unknown' },
  chiefComplaint: { type: String, default: '' },
  suggestedQuestions: { type: [String], default: [] },
  generatedAt: { type: Date, default: null },
  llmFailed: { type: Boolean, default: false },
}, { _id: false });

const postVisitSummarySchema = new mongoose.Schema({
  summary: { type: String, default: '' },
  medicationSchedule: { type: String, default: '' },
  followUpSteps: { type: String, default: '' },
  generatedAt: { type: Date, default: null },
  llmFailed: { type: Boolean, default: false },
}, { _id: false });

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slotStart: { type: Date, required: true },
  slotEnd: { type: Date, required: true },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'cancelled_by_leave', 'completed'],
    default: 'confirmed',
  },
  symptoms: { type: String, default: '' },
  preVisitSummary: { type: preVisitSummarySchema, default: () => ({}) },
  postVisitNotes: { type: String, default: '' },
  prescription: { type: String, default: '' }, // free text, parsed for reminders
  postVisitSummary: { type: postVisitSummarySchema, default: () => ({}) },
  calendarEvent: {
    eventId: { type: String, default: null },
    htmlLink: { type: String, default: null },
  },
  cancelReason: { type: String, default: '' },
}, { timestamps: true });

// Prevents true double-booking at the DB layer: only one non-cancelled
// appointment can occupy a given doctor+slotStart combination.
appointmentSchema.index(
  { doctorId: 1, slotStart: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['confirmed', 'completed'] } },
  }
);

appointmentSchema.index({ patientId: 1, slotStart: -1 });
appointmentSchema.index({ doctorId: 1, slotStart: -1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
