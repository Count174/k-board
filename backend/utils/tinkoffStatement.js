/**
 * Парсинг XLSX-выписок Тинькофф (и схожих): строки с заголовками на русском.
 * Маппинг банковских категорий → названия категорий в приложении (поиск по имени/синонимам в insertFinanceRecord).
 */

/** Банковская категория (колонка «Категория») → целевое имя для учёта */
const BANK_CATEGORY_TO_APP = {
  Такси: 'Транспорт',
  'Местный транспорт': 'Транспорт',
  Фастфуд: 'еда вне дома',
  Рестораны: 'еда вне дома',
};

function normHeader(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Парсинг суммы вида "-3 209,16" или "238,63" */
function parseAmountRu(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return val;
  const t = String(val)
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Excel serial date → YYYY-MM-DD (UTC), для ячеек-дат из Numbers/Excel */
function parseExcelSerialToYmd(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 20000 || n > 1000000) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Дата операции: 11.04.2026 11:57:19 → YYYY-MM-DD */
function parseOperationDate(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const fromSerial = parseExcelSerialToYmd(val);
    if (fromSerial) return fromSerial;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

/** Пропуск только при явном тексте в описании (категория «Переводы» у зарплаты не должна мешать). */
function isOwnAccountTransfer(_bankCategory, description) {
  return normHeader(description).includes('между своими счетами');
}

/**
 * Находит строку заголовков (первая, где есть «дата операции» и «статус» / «сумма»).
 */
function findHeaderRow(matrix, maxScan = 30) {
  for (let r = 0; r < Math.min(matrix.length, maxScan); r++) {
    const row = matrix[r] || [];
    const joined = row.map((c) => normHeader(c)).join(' | ');
    if (joined.includes('дата операции') && (joined.includes('статус') || joined.includes('сумма'))) {
      return r;
    }
  }
  return -1;
}

/**
 * Строит индекс колонок по заголовкам
 */
function mapColumns(headerRow) {
  const idx = {};
  headerRow.forEach((cell, i) => {
    const h = normHeader(cell);
    if (h.includes('дата операции')) idx.dateOp = i;
    if (h === 'статус' || h.includes('статус')) idx.status = i;
    if (h.includes('сумма операции')) idx.amount = i;
    // Обе колонки часто есть в выписке; «сумма платежа» нужна, если «сумма операции» в строке пустая (напр. зарплата).
    if (h.includes('сумма платежа')) idx.amountPay = i;
    if (h.includes('валюта операции')) idx.currency = i;
    if (!idx.currency && h.includes('валюта платежа')) idx.currencyPay = i;
    if (h.includes('категория')) idx.category = i;
    if (h.includes('описание')) idx.description = i;
  });
  if (idx.amount == null) idx.amount = idx.amountPay;
  if (idx.currency == null) idx.currency = idx.currencyPay;
  return idx;
}

/**
 * @param {object[][]} matrix — sheet as array of rows
 * @returns {{ items: object[], skipped: object[], errors: string[] }}
 */
function buildImportItems(matrix) {
  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx < 0) {
    return {
      items: [],
      skipped: [],
      errors: ['Не найдена строка заголовков (нужны колонки «Дата операции» и «Статус» или «Сумма»).'],
    };
  }

  const col = mapColumns(matrix[headerRowIdx]);
  if (col.dateOp == null || col.status == null || (col.amount == null && col.amountPay == null)) {
    return {
      items: [],
      skipped: [],
      errors: ['Не удалось сопоставить колонки выписки (ожидается формат Тинькофф).'],
    };
  }

  const items = [];
  const skipped = [];
  const errors = [];

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const status = String(row[col.status] ?? '').trim().toUpperCase();
    const rawOp = col.amount != null ? row[col.amount] : undefined;
    const rawPay = col.amountPay != null ? row[col.amountPay] : undefined;
    let amountSigned = parseAmountRu(rawOp);
    if (!Number.isFinite(amountSigned) || Math.abs(amountSigned) < 1e-9) {
      amountSigned = parseAmountRu(rawPay);
    }
    const dateStr = parseOperationDate(row[col.dateOp]);
    const bankCategory = String(row[col.category] ?? '').trim();
    const description = String(row[col.description] ?? '').trim();
    const currency = String(row[col.currency] ?? 'RUB')
      .trim()
      .toUpperCase() || 'RUB';

    if (!status) {
      skipped.push({ row: r + 1, reason: 'пустой статус' });
      continue;
    }
    if (status !== 'OK') {
      skipped.push({ row: r + 1, reason: `статус ${status}` });
      continue;
    }
    if (!dateStr) {
      skipped.push({ row: r + 1, reason: 'нет даты операции' });
      continue;
    }
    if (!Number.isFinite(amountSigned) || Math.abs(amountSigned) < 1e-9) {
      skipped.push({ row: r + 1, reason: 'нулевая или неверная сумма' });
      continue;
    }

    if (isOwnAccountTransfer(bankCategory, description)) {
      skipped.push({ row: r + 1, reason: 'перевод между своими счетами' });
      continue;
    }

    const type = amountSigned < 0 ? 'expense' : 'income';
    const amount = Math.abs(amountSigned);

    const mappedName = BANK_CATEGORY_TO_APP[bankCategory] || bankCategory;
    const comment = [description, bankCategory && mappedName !== bankCategory ? `(${bankCategory})` : '']
      .filter(Boolean)
      .join(' ')
      .trim();

    items.push({
      type,
      amount,
      date: dateStr,
      category: mappedName,
      comment: comment || description,
      currency,
    });
  }

  return { items, skipped, errors };
}

module.exports = {
  buildImportItems,
  parseAmountRu,
  parseOperationDate,
  BANK_CATEGORY_TO_APP,
  findHeaderRow,
  mapColumns,
};
