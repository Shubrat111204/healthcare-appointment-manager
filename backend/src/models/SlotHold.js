const mongoose = require('mongoose');

// Short-lived hold created the instant a patient selects a slot, before the
// symptom form + confirmation step completes. Prevents two patients from
// both landing on the confirm screen for the same slot. Auto-expires via
// MongoDB TTL index if the patient never confirms.
const slotHoldSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slotStart: { type: Date, required: true },
  slotEnd: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

slotHoldSchema.index(
  { doctorId: 1, slotStart: 1 },
  { unique: true }
);
slotHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SlotHold', slotHoldSchema);
