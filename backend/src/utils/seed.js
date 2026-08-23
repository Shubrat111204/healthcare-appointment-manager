// Run with: npm run seed
// Creates the admin account and one sample doctor so you can log in and
// demo the app immediately.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

async function seed() {
  await connectDB();

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@clinic.com').toLowerCase();
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10);
    admin = await User.create({
      name: process.env.ADMIN_NAME || 'Clinic Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
    });
    console.log(`Admin created: ${adminEmail} / ${process.env.ADMIN_PASSWORD || 'Admin@12345'}`);
  } else {
    console.log('Admin already exists, skipping.');
  }

  const doctorEmail = 'dr.sharma@clinic.com';
  let doctor = await User.findOne({ email: doctorEmail });
  if (!doctor) {
    const passwordHash = await bcrypt.hash('Doctor@12345', 10);
    doctor = await User.create({
      name: 'Sharma',
      email: doctorEmail,
      passwordHash,
      role: 'doctor',
      doctorProfile: {
        specialisation: 'General Medicine',
        bio: 'Sample seeded doctor for demo purposes.',
        slotDurationMinutes: 30,
        workingHours: [
          { day: 1, start: '09:00', end: '13:00' }, // Monday
          { day: 2, start: '09:00', end: '13:00' }, // Tuesday
          { day: 3, start: '09:00', end: '13:00' }, // Wednesday
          { day: 4, start: '09:00', end: '13:00' }, // Thursday
          { day: 5, start: '09:00', end: '13:00' }, // Friday
        ],
        leaveDays: [],
      },
    });
    console.log(`Sample doctor created: ${doctorEmail} / Doctor@12345`);
  } else {
    console.log('Sample doctor already exists, skipping.');
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
