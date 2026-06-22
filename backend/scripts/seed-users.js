/**
 * scripts/seed-users.js
 * Creates an initial admin + teacher login so you can sign in to a fresh database.
 * Re-runnable: skips users that already exist. Passwords are hashed on create.
 *
 * Usage (on the server, after the backend is connected to MySQL):
 *   node scripts/seed-users.js
 *
 * Override defaults with env vars if you like:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASS, SEED_TEACHER_EMAIL, SEED_TEACHER_PASS
 */

require('dotenv').config();
const sequelize = require('../src/config/sequelize');
const { User } = require('../src/models');

const users = [
  {
    name: 'Administrator',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@mcqpros.com',
    password: process.env.SEED_ADMIN_PASS || 'Admin@12345',
    role: 'admin',
  },
  {
    name: 'Demo Teacher',
    email: process.env.SEED_TEACHER_EMAIL || 'teacher@mcqpros.com',
    password: process.env.SEED_TEACHER_PASS || 'Teacher@12345',
    role: 'teacher',
  },
];

(async () => {
  await sequelize.authenticate();
  await sequelize.sync();

  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`• already exists: ${u.email} (role: ${existing.role})`);
      continue;
    }
    await User.create(u); // beforeSave hook hashes the password
    console.log(`✓ created ${u.role.padEnd(8)} → email: ${u.email}   password: ${u.password}`);
  }

  console.log('\n✅ SEED COMPLETE. Log in at https://mcqpros.com with the credentials above.');
  console.log('   (Change these passwords after first login.)');
  process.exit(0);
})().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
