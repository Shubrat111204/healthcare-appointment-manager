const cron = require('node-cron');
const MedicationReminder = require('../models/MedicationReminder');
const User = require('../models/User');
const { sendEmail, templates } = require('../services/emailService');

async function processDueReminders() {
  const due = await MedicationReminder.find({ active: true, nextSendAt: { $lte: new Date() } }).limit(100);
  for (const reminder of due) {
    try {
      const patient = await User.findById(reminder.patientId);
      if (!patient) continue;

      await sendEmail({
        to: patient.email,
        subject: `Medication Reminder: ${reminder.medicationName}`,
        html: templates.medicationReminder(patient.name, reminder.medicationName, reminder.instructions),
        type: 'medication_reminder',
        relatedAppointment: reminder.appointmentId,
      });

      reminder.dosesRemaining -= 1;
      if (reminder.dosesRemaining <= 0) {
        reminder.active = false;
      } else {
        const intervalMs = (24 * 60 * 60 * 1000) / reminder.timesPerDay;
        reminder.nextSendAt = new Date(Date.now() + intervalMs);
      }
      await reminder.save();
    } catch (err) {
      console.error('[medicationReminderJob] failed for reminder', reminder._id, err.message);
      // Leave it due — it'll be retried on the next tick rather than silently dropped.
    }
  }
}

function startMedicationReminderJob() {
  const schedule = process.env.MEDICATION_REMINDER_CRON || '*/15 * * * *';
  cron.schedule(schedule, () => {
    processDueReminders().catch((err) => console.error('[medicationReminderJob] tick failed:', err.message));
  });
  console.log(`Medication reminder job scheduled: ${schedule}`);
}

module.exports = { startMedicationReminderJob, processDueReminders };
