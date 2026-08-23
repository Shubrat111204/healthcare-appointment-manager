const cron = require('node-cron');
const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');

const MAX_RETRIES = 5;

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// Retries anything left in "failed" state (SMTP outage, transient network
// error, etc.) up to MAX_RETRIES times before giving up. This is what
// makes email delivery reliable rather than "fire and forget".
async function retryFailedEmails() {
  const failed = await EmailLog.find({ status: 'failed', retryCount: { $lt: MAX_RETRIES } }).limit(50);
  for (const log of failed) {
    try {
      await transporter().sendMail({ from: process.env.EMAIL_FROM, to: log.to, subject: log.subject, html: log.html });
      log.status = 'sent';
      log.sentAt = new Date();
    } catch (err) {
      log.retryCount += 1;
      log.lastError = err.message;
      console.error(`[emailRetryJob] retry ${log.retryCount} failed for log ${log._id}:`, err.message);
    }
    await log.save();
  }
}

function startEmailRetryJob() {
  const schedule = process.env.EMAIL_RETRY_CRON || '*/5 * * * *';
  cron.schedule(schedule, () => {
    retryFailedEmails().catch((err) => console.error('[emailRetryJob] tick failed:', err.message));
  });
  console.log(`Email retry job scheduled: ${schedule}`);
}

module.exports = { startEmailRetryJob, retryFailedEmails };
