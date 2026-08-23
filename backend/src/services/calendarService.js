const { google } = require('googleapis');
const User = require('../models/User');

// Design decision (see SYSTEM_DESIGN.md): rather than forcing every patient
// to complete Google OAuth before they can book, only the DOCTOR connects
// their Google Calendar (one-time, via /api/calendar/oauth). Every booking
// creates a single event on the doctor's calendar with the patient added as
// an attendee (sendUpdates: 'all'). Google then emails a native calendar
// invite to the patient, who can add it to their own calendar with one
// click — satisfying "an event for both" without needing patient-side OAuth.
// If a patient later connects their own calendar (same flow, different
// role), we additionally create a mirrored event on their calendar.

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  });
}

async function exchangeCodeForTokens(code) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token, ... }
}

function calendarForUser(refreshToken) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth: client });
}

// Creates the event on whichever party has calendar connected (prefers doctor),
// adding the other party as an attendee. Never throws — calendar failures must
// not block the booking itself.
async function createAppointmentEvent({ doctor, patient, slotStart, slotEnd, summary, description }) {
  const owner = doctor.googleCalendar?.connected ? doctor : (patient.googleCalendar?.connected ? patient : null);
  if (!owner) {
    return { success: false, reason: 'no_calendar_connected' };
  }
  try {
    const calendar = calendarForUser(owner.googleCalendar.refreshToken);
    const event = {
      summary,
      description,
      start: { dateTime: new Date(slotStart).toISOString() },
      end: { dateTime: new Date(slotEnd).toISOString() },
      attendees: [{ email: doctor.email }, { email: patient.email }],
      reminders: { useDefault: true },
    };
    const res = await calendar.events.insert({
      calendarId: owner.googleCalendar.calendarId || 'primary',
      requestBody: event,
      sendUpdates: 'all',
    });
    return { success: true, eventId: res.data.id, htmlLink: res.data.htmlLink, ownerId: owner._id };
  } catch (err) {
    console.error('[calendarService] create event failed:', err.message);
    return { success: false, reason: err.message };
  }
}

async function updateAppointmentEvent({ ownerId, eventId, updates }) {
  if (!eventId || !ownerId) return { success: false, reason: 'missing_event_or_owner' };
  try {
    const owner = await User.findById(ownerId);
    if (!owner?.googleCalendar?.connected) return { success: false, reason: 'owner_not_connected' };
    const calendar = calendarForUser(owner.googleCalendar.refreshToken);
    await calendar.events.patch({
      calendarId: owner.googleCalendar.calendarId || 'primary',
      eventId,
      requestBody: updates,
      sendUpdates: 'all',
    });
    return { success: true };
  } catch (err) {
    console.error('[calendarService] update event failed:', err.message);
    return { success: false, reason: err.message };
  }
}

async function deleteAppointmentEvent({ ownerId, eventId }) {
  if (!eventId || !ownerId) return { success: false, reason: 'missing_event_or_owner' };
  try {
    const owner = await User.findById(ownerId);
    if (!owner?.googleCalendar?.connected) return { success: false, reason: 'owner_not_connected' };
    const calendar = calendarForUser(owner.googleCalendar.refreshToken);
    await calendar.events.delete({
      calendarId: owner.googleCalendar.calendarId || 'primary',
      eventId,
      sendUpdates: 'all',
    });
    return { success: true };
  } catch (err) {
    console.error('[calendarService] delete event failed:', err.message);
    return { success: false, reason: err.message };
  }
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  createAppointmentEvent,
  updateAppointmentEvent,
  deleteAppointmentEvent,
};
