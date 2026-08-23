# System Design Write-up

## Double-booking prevention

Two layers, not one, because "check availability then write" is never safe under
concurrency on its own.

**Layer 1 — DB-level uniqueness (the real guarantee).** `Appointment` has a
compound index `{doctorId, slotStart}`, unique, with a partial filter on
`status: {$in: ['confirmed','completed']}`. If two requests try to create an
appointment for the same doctor/slot at the same instant, MongoDB's own index
enforcement rejects the second insert with an E11000 error — this is atomic at
the storage engine level, so there's no race window an application-level
`findOne` + `create` could fall into. The controller catches `err.code === 11000`
and returns a 409 "slot just taken" response.

**Layer 2 — short-lived holds (UX, not the safety net).** Booking is two steps:
the patient picks a slot (`POST /appointments/hold`) before filling the symptom
form, then confirms (`POST /appointments/confirm`). Without a hold, patient A
could be filling in symptoms for a slot that patient B books and confirms first,
and A only finds out at the very end. A `SlotHold` document is created with the
same unique `{doctorId, slotStart}` index, so a second patient can't even start
filling the form for a slot someone else is holding — they get an immediate 409
instead of wasting time on the form. Holds carry a Mongo TTL index (`expiresAt`,
`expireAfterSeconds: 0`) so an abandoned hold self-cleans after 5 minutes without
needing a cron job. The hold is deleted the moment the real `Appointment` is
created, and if confirmation fails for any reason the hold simply expires.

## Doctor leave conflict handling

Leave is stored as an array of `Date`s on the doctor's profile
(`doctorProfile.leaveDays`). Slot generation (`generateCandidateSlots`) checks
leave days before generating candidates, so a doctor on leave shows zero
available slots for that date going forward — that's the "prevent new
conflicts" half.

The harder half is **existing** bookings on a day that later gets marked as
leave. `adminController.addLeave` runs in one request: it saves the leave day,
then queries all `confirmed` appointments for that doctor within the day's
bounds, and for each one: sets status to `cancelled_by_leave`, sends a
"doctor unavailable" email to the patient, and deletes the associated Google
Calendar event (best-effort — failure here doesn't block the cancellation
itself). The response returns the count and list of affected patients so the
admin has confirmation the notification actually went out, rather than a
silent "leave added" with no idea who was affected.

## Slot hold mechanism

Covered above — `SlotHold` is a separate, cheap collection rather than adding a
`held` status to `Appointment` itself. Keeping it separate means: (a) the
uniqueness constraint on real appointments stays simple (no need to reason
about `held` vs `confirmed` semantics in every query), (b) TTL expiry is free
via MongoDB rather than a polling job, and (c) a hold that expires leaves zero
trace in the appointment history, which is the correct behavior — an abandoned
hold was never a real booking.

## Notification failure handling

Every outbound email goes through `emailService.sendEmail`, which writes an
`EmailLog` row (`status: pending`) **before** attempting delivery, then updates
it to `sent` or `failed`. The calling code (booking, cancellation, leave
notice, post-visit summary) never throws on email failure — a bad SMTP
connection must never roll back a successful booking. A cron job
(`emailRetryJob`, default every 5 minutes) scans for `status: failed` rows with
`retryCount < 5` and retries them, incrementing `retryCount` and recording
`lastError` on each attempt. After 5 failed attempts a row is left as a
permanent audit record rather than retried forever. The same
"log-first, never-throw" pattern applies to Google Calendar calls and to LLM
calls (`llmService`): a failed pre-visit summary returns a fallback object with
`llmFailed: true` instead of throwing, so the doctor still sees the raw
symptom text and the booking still completes — the UI shows an explicit
"AI summary unavailable" note rather than pretending nothing went wrong.

Medication reminders follow the same due-based polling pattern
(`medicationReminderJob`, default every 15 minutes): each `MedicationReminder`
document tracks `nextSendAt` and `dosesRemaining`; a failed send simply leaves
the document due for the next tick rather than advancing the schedule, so a
reminder is never silently skipped.
