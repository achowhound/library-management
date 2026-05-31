require('dotenv').config();
const prisma = require('../lib/prisma');
const { runDueReminderJob } = require('../services/dueReminder');

async function main() {
  try {
    await prisma.$connect();
    console.log('Connected to DB, running due reminder job...');
    const result = await runDueReminderJob();
    console.log('Done:', result);
  } catch (err) {
    console.error('Error running due reminder job:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
