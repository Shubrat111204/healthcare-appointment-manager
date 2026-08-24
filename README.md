# Healthcare Appointment & Follow-up Manager

A full-stack clinic platform with separate patient, doctor, and admin
portals: booking with conflict-safe slot management, AI-generated pre-visit
and post-visit summaries, email notifications, and Google Calendar sync.

**Stack:** Node.js / Express / MongoDB (backend) + React / Vite / Tailwind
(frontend) + Anthropic Claude (LLM) + Nodemailer (email) + Google Calendar
API (OAuth 2.0).

See [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) for the write-up on double-booking
prevention, leave conflict handling, the slot hold mechanism, and
notification failure handling.
**Live Link** : (https://healthcare-appointment-manager-puce.vercel.app/login)

---

## 1. Project structure

```
backend/
  server.js
  src/
    config/db.js
    middleware/        auth (JWT), error handler
    models/             User, Appointment, SlotHold, EmailLog, MedicationReminder
    controllers/         auth, doctor, appointment, admin, calendar
    routes/
    services/            llmService, emailService, calendarService
    jobs/                medicationReminderJob, emailRetryJob (node-cron)
    utils/               generateSlots.js, seed.js
frontend/
  src/
    api/axios.js
    context/AuthContext.jsx
    components/          Navbar, ProtectedRoute
    pages/
      Login, Register
      patient/            DoctorSearch, BookAppointment, PatientDashboard
      doctor/              DoctorDashboard, PostVisitNotes
      admin/               AdminDashboard, ManageDoctors
SYSTEM_DESIGN.md
```

## 2. Prerequisites

- Node.js 18+
- MongoDB running locally, or a free MongoDB Atlas cluster
- (Optional but recommended for full functionality) an Anthropic API key, an
  SMTP account (Gmail App Password / Mailtrap / SendGrid), and Google OAuth
  credentials. The app **does not crash without these** — LLM, email, and
  calendar all degrade gracefully (see SYSTEM_DESIGN.md) so you can demo the
  core booking flow with zero external accounts configured.

## 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env — at minimum set MONGO_URI and JWT_SECRET
npm run seed     # creates an admin account + one sample doctor
npm run dev      # starts on http://localhost:5000
```

Seeded accounts (from `npm run seed`, using the defaults in `.env.example`):

| Role   | Email                | Password       |
|--------|-----------------------|-----------------|
| Admin  | admin@clinic.com      | Admin@12345     |
| Doctor | dr.sharma@clinic.com  | Doctor@12345    |

Patients register themselves from the app's Register page.

## 4. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:5000/api
npm run dev             # starts on http://localhost:5173
```

## 5. Environment variables reference

All variables live in `backend/.env.example` with inline comments. Key ones:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs auth tokens |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Pre-visit & post-visit AI summaries |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` | Nodemailer transport |
| `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI` | Calendar OAuth |
| `MEDICATION_REMINDER_CRON`, `EMAIL_RETRY_CRON` | Background job schedules |
| `HOLD_TTL_MINUTES` | How long a slot hold lasts before auto-expiring |

## 6. LLM prompts used

**Pre-visit summary** (`src/services/llmService.js::generatePreVisitSummary`):
> "Analyse these symptoms and return: urgency level (Low / Medium / High),
> chief complaint, and three suggested questions for the doctor. Symptoms:
> `<symptoms>`" — model is instructed to respond as strict JSON, which is
> parsed and stored on the appointment. On any failure (timeout, bad key,
> unparsable response) the app falls back to a safe default and flags
> `llmFailed: true` rather than blocking the booking.

**Post-visit summary** (`generatePostVisitSummary`):
> "Convert these clinical notes into a patient-friendly summary with
> medication schedule and follow-up steps: `<notes>`" — same JSON-and-fallback
> pattern.

## 7. Database schema (high level)

- **User** — `role` (`patient`/`doctor`/`admin`), and for doctors an embedded
  `doctorProfile` (specialisation, working hours per weekday, slot duration,
  leave days) and `googleCalendar` (OAuth connection state).
- **Appointment** — patient/doctor refs, `slotStart`/`slotEnd`, `status`,
  symptoms, `preVisitSummary`, `postVisitNotes`, `prescription`,
  `postVisitSummary`, calendar event ref. Unique partial index on
  `{doctorId, slotStart}` for confirmed/completed appointments — this is
  what actually prevents double-booking.
- **SlotHold** — short-lived, TTL-indexed hold taken the moment a patient
  picks a slot, before they've finished the symptom form.
- **EmailLog** — every email attempt, with `status`/`retryCount` for the
  retry job.
- **MedicationReminder** — one row per prescribed medication, polled by a
  cron job to send dose reminders.

Full field-level detail is in `backend/src/models/*.js` — each file is
commented with the reasoning behind non-obvious fields.

## 8. API overview

| Method & path | Role | Purpose |
|---|---|---|
| `POST /api/auth/register` | public | Patient self-registration |
| `POST /api/auth/login` | public | Login (all roles) |
| `GET /api/doctors?specialisation=` | any | Search doctors |
| `GET /api/doctors/:id/slots?date=` | any | Available slots for a date |
| `POST /api/appointments/hold` | patient | Step 1: hold a slot |
| `POST /api/appointments/confirm` | patient | Step 2: symptoms + confirm |
| `GET /api/appointments/my` | patient | My appointments |
| `GET /api/appointments/doctor/queue` | doctor | Upcoming queue + AI summaries |
| `POST /api/appointments/:id/cancel` | patient/doctor/admin | Cancel |
| `POST /api/appointments/:id/post-visit` | doctor | Notes → AI summary + reminders |
| `POST /api/admin/doctors` | admin | Create doctor + profile |
| `PATCH /api/admin/doctors/:id` | admin | Update doctor profile |
| `POST /api/admin/doctors/:id/leave` | admin | Mark leave day, auto-notify affected patients |
| `GET /api/admin/appointments` | admin | All appointments |
| `GET /api/calendar/oauth/connect` | patient/doctor | Start Google Calendar OAuth |
| `GET /api/calendar/oauth/callback` | — | OAuth redirect target |

## 9. Google Calendar setup

1. Create a project at https://console.cloud.google.com/
2. Enable the **Google Calendar API**
3. Create OAuth 2.0 credentials (Web application), add
   `http://localhost:5000/api/calendar/oauth/callback` as an authorized
   redirect URI (update this to your deployed backend URL in production)
4. Put the client ID/secret in `backend/.env`
5. In the app, a doctor logs in and hits `GET /api/calendar/oauth/connect`
   (wire a "Connect Google Calendar" button to this, or call it directly)
   to authorize; the refresh token is stored on their user record

**Design note:** only the doctor needs to connect their calendar for the
event to exist and for the patient to get a native Google invite email
(`sendUpdates: 'all'`) — see SYSTEM_DESIGN.md for why this avoids forcing
every patient through OAuth just to book an appointment.

## 10. Deploying

- **Backend:** Render / Railway — set the `backend` folder as the root,
  build command `npm install`, start command `npm start`, and paste in the
  same env vars. Use a MongoDB Atlas free-tier cluster for `MONGO_URI`.
- **Frontend:** Vercel / Netlify — root `frontend`, build command
  `npm run build`, output dir `dist`. Set `VITE_API_BASE_URL` to your
  deployed backend's `/api` URL.
- Remember to update `GOOGLE_REDIRECT_URI` and `CLIENT_URL` on the backend
  to your deployed URLs once hosted.

## 11. Pushing to GitHub

```bash
cd healthcare-appointment-manager
git init
git add .
git commit -m "Healthcare Appointment & Follow-up Manager"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```
(Create the empty repo on GitHub first, and make sure it's set to **Public**
so the evaluator can view it.)

## 12. Known scope simplifications (for transparency)

- Working-hours editing from the admin UI is limited to the default
  Mon–Fri 9–5 template on doctor creation; the API (`PATCH /admin/doctors/:id`)
  supports arbitrary per-weekday hours if you want to extend the UI.
- Medication parsing is a structured form (name/instructions/frequency/days)
  rather than free-text NLP extraction from the prescription field, to keep
  reminder scheduling deterministic and testable.
- Calendar sync creates one event per booking on the doctor's calendar
  (patient invited as attendee) rather than requiring dual OAuth — documented
  above and in SYSTEM_DESIGN.md.
