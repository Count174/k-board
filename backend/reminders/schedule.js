const cron = require('node-cron');
const { getBot } = require('../bot/index');
const { runMedicationReminders } = require('./medicationReminders');
const { runWorkoutReminders } = require('./workoutReminders');
const { runExpenseReminders } = require('./expenseReminders');
const { ensurePushSchema } = require('../utils/pushDeviceStore');

const TZ = { timezone: 'Europe/Moscow' };

function startReminderSchedules() {
  ensurePushSchema().catch((e) => console.error('[reminders] schema:', e));

  cron.schedule('* * * * *', () => {
    const bot = getBot();
    runMedicationReminders(bot);
  }, TZ);

  cron.schedule('* * * * *', () => {
    const bot = getBot();
    runWorkoutReminders(bot);
  }, TZ);

  cron.schedule('30 19 * * *', () => {
    const bot = getBot();
    runExpenseReminders(bot);
  }, TZ);

  console.log('[reminders] push schedules started (medications, workouts, expenses 19:30 MSK)');
}

module.exports = { startReminderSchedules };
