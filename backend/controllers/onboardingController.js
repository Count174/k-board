const db = require('../db/db');
const dayjs = require('dayjs');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

// ——— вспомогалки
function nextDatesForWeekdays(weekdays, startDateISO, daysHorizon = 14) {
  // weekdays: массив 1..7 (пн..вс), startDateISO: YYYY-MM-DD
  const out = [];
  const start = dayjs(startDateISO || dayjs().format('YYYY-MM-DD'));
  for (let i = 0; i < daysHorizon; i++) {
    const d = start.add(i, 'day');
    const wd = ((d.day() + 6) % 7) + 1; // day(): 0..6 (воскресенье=0) -> 1..7 (пн..вс)
    if (weekdays.includes(wd)) out.push(d.format('YYYY-MM-DD'));
  }
  return out;
}

// GET /onboarding/state
exports.state = async (req, res) => {
  const userId = req.userId;
  try {
    const row = await get(
      `SELECT status, step, payload_json
         FROM onboarding_state
        WHERE user_id=?`,
      [userId]
    );
    if (!row) {
      // по умолчанию — можно показывать
      return res.json({ status: 'not_started', step: null, payload: {}, can_show: true });
    }
    const payload = (() => { try { return JSON.parse(row.payload_json || '{}'); } catch { return {}; }})();
    const can_show = row.status === 'not_started' || row.status === 'in_progress';
    return res.json({ status: row.status, step: row.step, payload, can_show });
  } catch (e) {
    return res.json({ status: 'not_started', step: null, payload: {}, can_show: true });
  }
};

// PATCH /onboarding/state
exports.patch = async (req, res) => {
  const userId = req.userId;
  const { status = 'in_progress', step = 'welcome', patch = {} } = req.body || {};
  try {
    const row = await get(
      `SELECT payload_json
         FROM onboarding_state
        WHERE user_id=?`,
      [userId]
    );
    const current = (() => { try { return JSON.parse(row?.payload_json || '{}'); } catch { return {}; }})();
    const nextPayload = { ...current, ...patch };
    await run(
      `INSERT INTO onboarding_state (user_id, status, step, payload_json, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         status=excluded.status,
         step=excluded.step,
         payload_json=excluded.payload_json,
         updated_at=CURRENT_TIMESTAMP`,
      [userId, status, step, JSON.stringify(nextPayload)]
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'db_error' });
  }
};

// POST /onboarding/dismiss
exports.dismiss = async (req, res) => {
  const userId = req.userId;
  try {
    await run(
      `INSERT INTO onboarding_state (user_id, status, step, payload_json, updated_at)
       VALUES (?, 'dismissed', 'welcome', '{}', CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET status='dismissed', updated_at=CURRENT_TIMESTAMP`,
      [userId]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'db_error' });
  }
};

// POST /onboarding/complete — автоприменение + пометка completed
exports.complete = async (req, res) => {
  const userId = req.userId;
  try {
    const st = await get(
      `SELECT payload_json
         FROM onboarding_state
        WHERE user_id=?`,
      [userId]
    );
    const payload = (() => { try { return JSON.parse(st?.payload_json || '{}'); } catch { return {}; }})();

    // 1) ТРЕНИРОВКИ: training_days [1..7], training_time "HH:MM" — создаём на 2 недели
    if (Array.isArray(payload.training_days) && payload.training_days.length && payload.training_time) {
      const dates = nextDatesForWeekdays(payload.training_days, dayjs().format('YYYY-MM-DD'), 14);
      for (const d of dates) {
        await run(
          `INSERT INTO health (type, date, time, place, activity, notes, completed, user_id)
           VALUES ('training', ?, ?, '', 'Тренировка', '', 0, ?)`,
          [d, payload.training_time, userId]
        );
      }
    }

    // 2) МЕДИКАМЕНТЫ: если пользователь указал, создаём один курс «черновик»
    // Простая логика: имя = meds_example (или «Добавка»), ежедневно в 09:00 на 30 дней.
    if (payload.meds_has) {
      const name = (payload.meds_example || '').trim() || 'Добавка';
      const start = dayjs().format('YYYY-MM-DD');
      const end = dayjs().add(30, 'day').format('YYYY-MM-DD');
      await run(
        `INSERT INTO medications (user_id, name, dosage, frequency, times, start_date, end_date, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [userId, name, '', 'daily', JSON.stringify(['09:00']), start, end]
      );
    }

    // 3) ЦЕЛИ: payload.goals — массив {title, target, unit, is_binary}
    if (Array.isArray(payload.goals)) {
      for (const g of payload.goals) {
        const title = String(g.title || '').trim();
        if (!title) continue;
        const target = Number(g.target || (g.is_binary ? 1 : 0));
        const unit = String(g.unit || '').trim();
        const isBinary = g.is_binary ? 1 : 0;
        // вставляем только если такой цели не было (по title)
        await run(
          `INSERT INTO goals (user_id, title, current, target, unit, is_binary, image)
           SELECT ?, ?, 0, ?, ?, ?, ''
           WHERE NOT EXISTS (
             SELECT 1 FROM goals
              WHERE user_id=? AND LOWER(TRIM(title))=LOWER(TRIM(?))
           )`,
          [userId, title, target, unit, isBinary, userId, title]
        );
      }
    }

    // 4) БЮДЖЕТЫ текущего месяца: payload.budget_preset — [{category, amount}]
    if (Array.isArray(payload.budget_preset) && payload.budget_preset.length) {
      const month = dayjs().format('YYYY-MM');
      for (const b of payload.budget_preset) {
        const category = String(b.category || '').trim().toLowerCase();
        const amount = Number(b.amount || 0);
        if (!category || amount <= 0) continue;
        await run(
          `INSERT INTO budgets (user_id, month, category, amount)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, month, category) DO UPDATE SET amount=excluded.amount`,
          [userId, month, category, amount]
        );
      }
    }

    // 5) финальный статус
    await run(
      `INSERT INTO onboarding_state (user_id, status, step, payload_json, updated_at)
       VALUES (?, 'completed', 'finish', '{}', CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         status='completed', step='finish', payload_json='{}', updated_at=CURRENT_TIMESTAMP`,
      [userId]
    );

    return res.json({ ok: true, applied: true });
  } catch (e) {
    console.error('onboarding.complete error:', e);
    return res.status(500).json({ error: 'apply_failed' });
  }
};