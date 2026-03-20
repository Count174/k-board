const db = require('../db/db');

const SUPPORTED_CURRENCIES = new Set(['RUB', 'EUR', 'USD', 'TRY']);

const CURRENCY_ALIASES = {
  rub: 'RUB', rubl: 'RUB', ruble: 'RUB', roubles: 'RUB', 'руб': 'RUB', 'руб.': 'RUB', '₽': 'RUB',
  eur: 'EUR', euro: 'EUR', euros: 'EUR', 'евро': 'EUR', '€': 'EUR',
  usd: 'USD', dollar: 'USD', dollars: 'USD', 'доллар': 'USD', 'доллара': 'USD', 'долларов': 'USD', '$': 'USD',
  try: 'TRY', lira: 'TRY', 'лира': 'TRY', 'лиры': 'TRY', 'лир': 'TRY', '₺': 'TRY',
};

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

let fxSchemaReady = false;
let fxSchemaPromise = null;

async function ensureFxSchema() {
  if (fxSchemaReady) return;
  if (!fxSchemaPromise) {
    fxSchemaPromise = dbRun(
      `CREATE TABLE IF NOT EXISTS fx_rates (
        rate_date TEXT NOT NULL,
        base_currency TEXT NOT NULL,
        quote_currency TEXT NOT NULL,
        rate REAL NOT NULL,
        source TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (rate_date, base_currency, quote_currency)
      )`
    ).then(() => {
      fxSchemaReady = true;
    }).catch((e) => {
      fxSchemaPromise = null;
      throw e;
    });
  }
  await fxSchemaPromise;
}

function normalizeCurrency(raw) {
  if (!raw) return 'RUB';
  const key = String(raw).trim().toLowerCase();
  if (!key) return 'RUB';
  const mapped = CURRENCY_ALIASES[key] || key.toUpperCase();
  return SUPPORTED_CURRENCIES.has(mapped) ? mapped : null;
}

function normalizeDate(dateLike) {
  if (!dateLike) return new Date().toISOString().slice(0, 10);
  const d = new Date(String(dateLike));
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function getCachedRate(dateIso, baseCurrency, quoteCurrency = 'RUB') {
  await ensureFxSchema();
  return dbGet(
    `SELECT rate
       FROM fx_rates
      WHERE rate_date = ? AND base_currency = ? AND quote_currency = ?
      LIMIT 1`,
    [dateIso, baseCurrency, quoteCurrency]
  );
}

async function cacheRate(dateIso, baseCurrency, quoteCurrency, rate, source = 'frankfurter') {
  await ensureFxSchema();
  await dbRun(
    `INSERT INTO fx_rates (rate_date, base_currency, quote_currency, rate, source, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(rate_date, base_currency, quote_currency) DO UPDATE SET
       rate = excluded.rate,
       source = excluded.source,
       updated_at = CURRENT_TIMESTAMP`,
    [dateIso, baseCurrency, quoteCurrency, Number(rate), source]
  );
}

async function fetchLatestRate(baseCurrency, quoteCurrency = 'RUB') {
  const latestUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(quoteCurrency)}`;
  const latestResp = await fetch(latestUrl);
  const latestData = await latestResp.json().catch(() => ({}));
  if (!latestResp.ok) {
    throw new Error(latestData?.message || latestData?.error || `fx_http_${latestResp.status}`);
  }
  const latestRate = Number(latestData?.rates?.[quoteCurrency]);
  if (!Number.isFinite(latestRate) || latestRate <= 0) {
    throw new Error('fx_rate_missing');
  }
  return { rate: latestRate, date: latestData?.date || null };
}

async function fetchHistoricalRate(dateIso, baseCurrency, quoteCurrency = 'RUB') {
  const url = `https://api.frankfurter.app/${dateIso}?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(quoteCurrency)}`;
  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = String(data?.message || data?.error || `fx_http_${resp.status}`).toLowerCase();
    // У Frankfurter историческая дата иногда может быть недоступна (например, ещё нет публикации за день).
    // В этом случае пробуем latest как мягкий fallback.
    if (resp.status === 404 || msg.includes('not found')) {
      const latest = await fetchLatestRate(baseCurrency, quoteCurrency);
      const effectiveDate = latest.date || dateIso;
      await cacheRate(dateIso, baseCurrency, quoteCurrency, latest.rate, 'frankfurter-latest-fallback');
      await cacheRate(effectiveDate, baseCurrency, quoteCurrency, latest.rate, 'frankfurter-latest-fallback');
      return latest.rate;
    }
    throw new Error(data?.message || data?.error || `fx_http_${resp.status}`);
  }

  // Иногда сервис отвечает 200, но без rates с текстом "not found".
  const softMsg = String(data?.message || data?.error || '').toLowerCase();
  if ((!data?.rates || data?.rates?.[quoteCurrency] == null) && softMsg.includes('not found')) {
    const latest = await fetchLatestRate(baseCurrency, quoteCurrency);
    const effectiveDate = latest.date || dateIso;
    await cacheRate(dateIso, baseCurrency, quoteCurrency, latest.rate, 'frankfurter-latest-fallback');
    await cacheRate(effectiveDate, baseCurrency, quoteCurrency, latest.rate, 'frankfurter-latest-fallback');
    return latest.rate;
  }

  const rate = Number(data?.rates?.[quoteCurrency]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('fx_rate_missing');
  }
  const actualDate = data?.date || dateIso;
  await cacheRate(dateIso, baseCurrency, quoteCurrency, rate);
  if (actualDate !== dateIso) {
    await cacheRate(actualDate, baseCurrency, quoteCurrency, rate);
  }
  return rate;
}

async function getRateToRubForDate(currency, dateLike) {
  await ensureFxSchema();
  const cur = normalizeCurrency(currency);
  if (!cur) throw new Error('unsupported_currency');
  if (cur === 'RUB') return 1;

  const dateIso = normalizeDate(dateLike);
  const cached = await getCachedRate(dateIso, cur, 'RUB');
  if (cached?.rate != null) return Number(cached.rate);

  try {
    return await fetchHistoricalRate(dateIso, cur, 'RUB');
  } catch (e) {
    const fallback = await dbGet(
      `SELECT rate
         FROM fx_rates
        WHERE base_currency = ? AND quote_currency = 'RUB' AND rate_date <= ?
     ORDER BY rate_date DESC
        LIMIT 1`,
      [cur, dateIso]
    );
    if (fallback?.rate != null) return Number(fallback.rate);
    throw e;
  }
}

module.exports = {
  normalizeCurrency,
  normalizeDate,
  getRateToRubForDate,
};
