// Generates candidate slots for a doctor on a given date from their
// working hours + slot duration, then filters out slots that are already
// held/booked or fall on a leave day.

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isOnLeave(doctorProfile, date) {
  return (doctorProfile.leaveDays || []).some((d) => isSameDate(new Date(d), date));
}

function generateCandidateSlots(doctorProfile, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  if (isOnLeave(doctorProfile, date)) return [];

  const weekday = date.getDay();
  const rule = (doctorProfile.workingHours || []).find((w) => w.day === weekday);
  if (!rule) return [];

  const [startH, startM] = rule.start.split(':').map(Number);
  const [endH, endM] = rule.end.split(':').map(Number);
  const duration = doctorProfile.slotDurationMinutes || 30;

  const slots = [];
  let cursor = new Date(date);
  cursor.setHours(startH, startM, 0, 0);
  const end = new Date(date);
  end.setHours(endH, endM, 0, 0);

  while (cursor.getTime() + duration * 60000 <= end.getTime()) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor.getTime() + duration * 60000);
    slots.push({ slotStart, slotEnd });
    cursor = slotEnd;
  }
  return slots;
}

module.exports = { generateCandidateSlots, isOnLeave, isSameDate };
