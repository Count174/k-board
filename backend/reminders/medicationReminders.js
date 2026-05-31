const db = require('../db/db');
const { dispatchReminder } = require('./dispatcher');
const { shouldNotifyToday, moscowNowParts } = require('./medicationUtils');

function runMedicationReminders(bot) {
  const { today, hhmm } = moscowNowParts();

  db.all(
    `SELECT m.*, tu.chat_id
       FROM medications m
       LEFT JOIN telegram_users tu ON tu.user_id = m.user_id
      WHERE m.active = 1
        AND m.start_date <= ?
        AND (m.end_date IS NULL OR m.end_date >= ?)`,
    [today, today],
    (err, rows) => {
      if (err) {
        console.error('[medicationReminders] db error:', err);
        return;
      }
      if (!rows?.length) return;

      const now = new Date();
      for (const m of rows) {
        let times = [];
        try {
          times = JSON.parse(m.times || '[]');
        } catch {
          times = [];
        }
        if (!shouldNotifyToday(m.frequency, now)) continue;
        if (!times.includes(hhmm)) continue;

        db.get(
          `SELECT 1 FROM medication_notifications
            WHERE medication_id = ? AND notify_date = ? AND notify_time = ?`,
          [m.id, today, hhmm],
          async (e, r) => {
            if (e || r) return;

            const dosage = m.dosage ? `, ${m.dosage}` : '';
            const title = 'Лекарство';
            const body = `Выпей ${m.name}${dosage} (${hhmm})`;
            const refKey = `med:${m.id}:${today}:${hhmm}`;

            await dispatchReminder(
              m.user_id,
              {
                title,
                body,
                kind: 'medication',
                refKey,
                screen: 'medications',
                entityId: m.id,
              },
              {
                bot,
                telegramChatId: m.chat_id,
                telegramText: `💊 Напоминание: выпей *${m.name}*${dosage} (${hhmm})`,
                telegramOptions: {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '✅ Выпил', callback_data: `med:take:${m.id}:${today}:${hhmm}` },
                        { text: '⏭ Пропустил', callback_data: `med:skip:${m.id}:${today}:${hhmm}` },
                      ],
                    ],
                  },
                },
                push: true,
                telegram: Boolean(m.chat_id),
              }
            );

            db.run(
              `INSERT OR IGNORE INTO medication_notifications (medication_id, notify_date, notify_time, sent)
               VALUES (?, ?, ?, 1)`,
              [m.id, today, hhmm]
            );
          }
        );
      }
    }
  );
}

module.exports = { runMedicationReminders };
