/**
 * Парсинг XLSX-выписок Тинькофф (и схожих): строки с заголовками на русском.
 * Маппинг банковских категорий → названия категорий в приложении (поиск по имени/синонимам в insertFinanceRecord).
 */

/** Включить: DEBUG_TINKOFF_IMPORT=1 в окружении — подробные логи в консоль (pm2 logs / journalctl). */
function isDebugImport() {
  const v = process.env.DEBUG_TINKOFF_IMPORT;
  return v === '1' || v === 'true' || v === 'yes';
}

function logImport(...args) {
  if (isDebugImport()) console.log('[tinkoff-import]', ...args);
}

function previewCell(val, maxLen = 64) {
  if (val == null) return '(null)';
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

/** Банковская категория (колонка «Категория») → целевое имя для учёта */
const BANK_CATEGORY_TO_APP = {
  Такси: 'Транспорт',
  'Местный транспорт': 'Транспорт',
  Фастфуд: 'еда вне дома',
  Рестораны: 'еда вне дома',
  Зарплата: 'Зарплата',
};

function normHeader(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Парсинг суммы из выписки / Excel.
 * Поддерживает: «173 963,00» и «-3 209,16» (RU), а также «173,963.00» (US/как отдаёт xlsx при raw: false).
 */
function parseAmountRu(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  let t = String(val)
    .trim()
    .replace(/\s/g, '')
    .replace(/\u00a0/g, '');

  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');

  if (lastDot > lastComma && lastDot !== -1) {
    // Десятичная точка (1,234.56): запятые — тысячи
    t = t.replace(/,/g, '');
  } else if (lastComma > lastDot && lastComma !== -1) {
    // Десятичная запятая (1.234,56 или 173963,16): точки — тысячи
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1 && lastDot === -1) {
    // Только запятая — десятичный разделитель
    t = t.replace(',', '.');
  }

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
 * Индекс колонки «Категория» в выписке Тинькофф.
 * Нельзя брать `includes('категория')` на каждой ячейке: «Подкатегория» содержит ту же подстроку и перезаписывала бы индекс
 * (у зарплаты в подкатегории часто пусто — терялась «Зарплата»).
 * Сначала ищем заголовок ровно «Категория», иначе — первую колонку с «категория», но не «подкатегор».
 */
function pickCategoryColumnIndex(headerRow) {
  const norms = headerRow.map((c) => normHeader(c));
  for (let i = 0; i < norms.length; i++) {
    if (norms[i] === 'категория') return i;
  }
  for (let i = 0; i < norms.length; i++) {
    const h = norms[i];
    if (h.includes('подкатегор')) continue;
    if (h.includes('категория')) return i;
  }
  return null;
}

/**
 * «Сумма операции» — не путать с «Сумма операции с округлением»: обе содержат подстроку «сумма операции»,
 * последняя в файле перезаписывала idx.amount; в xlsx ячейка «с округлением» часто пустая → сумма не парсилась.
 */
function pickAmountOperationIndex(headerRow) {
  const norms = headerRow.map((c) => normHeader(c));
  for (let i = 0; i < norms.length; i++) {
    if (norms[i] === 'сумма операции') return i;
  }
  for (let i = 0; i < norms.length; i++) {
    const h = norms[i];
    if (h.includes('сумма операции') && !h.includes('округлен')) return i;
  }
  for (let i = 0; i < norms.length; i++) {
    if (norms[i].includes('сумма операции')) return i;
  }
  return null;
}

function pickAmountPaymentIndex(headerRow) {
  const norms = headerRow.map((c) => normHeader(c));
  for (let i = 0; i < norms.length; i++) {
    if (norms[i] === 'сумма платежа') return i;
  }
  for (let i = 0; i < norms.length; i++) {
    const h = norms[i];
    if (h.includes('сумма платежа') && !h.includes('округлен')) return i;
  }
  for (let i = 0; i < norms.length; i++) {
    if (norms[i].includes('сумма платежа')) return i;
  }
  return null;
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
    if (h.includes('валюта операции')) idx.currency = i;
    if (!idx.currency && h.includes('валюта платежа')) idx.currencyPay = i;
    // Только первая колонка описания (иначе «Комментарий к описанию» и т.п. перезаписывали бы).
    if (idx.description == null && h.includes('описание')) idx.description = i;
  });
  idx.category = pickCategoryColumnIndex(headerRow);
  idx.amount = pickAmountOperationIndex(headerRow);
  idx.amountPay = pickAmountPaymentIndex(headerRow);
  if (idx.amount == null) idx.amount = idx.amountPay;
  if (idx.currency == null) idx.currency = idx.currencyPay;
  return idx;
}

/**
 * @param {object[][]} matrix — sheet as array of rows
 * @returns {{ items: object[], skipped: object[], errors: string[] }}
 */
function buildImportItems(matrix) {
  logImport('строк в matrix:', matrix?.length ?? 0);

  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx < 0) {
    logImport('заголовки не найдены (нужны «дата операции» и «статус»/«сумма» в первых 30 строках)');
    return {
      items: [],
      skipped: [],
      errors: ['Не найдена строка заголовков (нужны колонки «Дата операции» и «Статус» или «Сумма»).'],
    };
  }

  const headerRow = matrix[headerRowIdx] || [];
  logImport('строка заголовков: индекс', headerRowIdx, '(Excel row', headerRowIdx + 1, ')');
  if (isDebugImport()) {
    const heads = headerRow.map((c, i) => `${i}:${previewCell(c, 48)}`);
    logImport('колонки заголовка:', heads.join(' | '));
  }

  const col = mapColumns(headerRow);
  logImport('индексы колонок:', JSON.stringify(col));

  if (col.dateOp == null || col.status == null || (col.amount == null && col.amountPay == null)) {
    logImport('ошибка сопоставления: dateOp=%s status=%s amount=%s amountPay=%s',
      col.dateOp, col.status, col.amount, col.amountPay);
    return {
      items: [],
      skipped: [],
      errors: ['Не удалось сопоставить колонки выписки (ожидается формат Тинькофф).'],
    };
  }

  const items = [];
  const skipped = [];
  const errors = [];

  if (headerRowIdx + 1 >= matrix.length && isDebugImport()) {
    logImport('после строки заголовков нет ни одной строки данных (matrix.length слишком мал?)');
  }

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const dateRaw = row[col.dateOp];
    const status = String(row[col.status] ?? '').trim().toUpperCase();
    const rawOp = col.amount != null ? row[col.amount] : undefined;
    const rawPay = col.amountPay != null ? row[col.amountPay] : undefined;
    let amountSigned = parseAmountRu(rawOp);
    if (!Number.isFinite(amountSigned) || Math.abs(amountSigned) < 1e-9) {
      amountSigned = parseAmountRu(rawPay);
    }
    const dateStr = parseOperationDate(dateRaw);
    const bankCategory = String(row[col.category] ?? '').trim();
    const description = String(row[col.description] ?? '').trim();
    const currency = String(row[col.currency] ?? 'RUB')
      .trim()
      .toUpperCase() || 'RUB';

    const excelRow = r + 1;
    const isEmptyRow =
      !String(status || '').trim() &&
      !String(bankCategory || '').trim() &&
      !String(description || '').trim() &&
      (!Number.isFinite(amountSigned) || Math.abs(amountSigned) < 1e-9);

    if (isDebugImport() && !isEmptyRow) {
      logImport(`--- Excel row ${excelRow} (matrix[${r}]), ячеек в строке: ${row.length}`);
      logImport('  dateRaw:', previewCell(dateRaw), '→', dateStr || '(нет даты)');
      logImport('  status:', previewCell(status), 'idx.status=', col.status);
      logImport('  сумма: rawOp=', previewCell(rawOp), 'rawPay=', previewCell(rawPay), '→ amountSigned=', amountSigned);
      logImport('  категория idx=', col.category, '→', previewCell(bankCategory));
      logImport('  описание idx=', col.description, '→', previewCell(description));
    }

    if (!status) {
      if (isDebugImport() && !isEmptyRow) logImport('  итог: ПРОПУСК — пустой статус');
      skipped.push({ row: excelRow, reason: 'пустой статус' });
      continue;
    }
    if (status !== 'OK') {
      if (isDebugImport()) logImport('  итог: ПРОПУСК —', `статус ${status}`);
      skipped.push({ row: excelRow, reason: `статус ${status}` });
      continue;
    }
    if (!dateStr) {
      if (isDebugImport()) logImport('  итог: ПРОПУСК — нет даты операции');
      skipped.push({ row: excelRow, reason: 'нет даты операции' });
      continue;
    }
    if (!Number.isFinite(amountSigned) || Math.abs(amountSigned) < 1e-9) {
      if (isDebugImport()) logImport('  итог: ПРОПУСК — нулевая или неверная сумма');
      skipped.push({ row: excelRow, reason: 'нулевая или неверная сумма' });
      continue;
    }

    if (isOwnAccountTransfer(bankCategory, description)) {
      if (isDebugImport()) logImport('  итог: ПРОПУСК — перевод между своими счетами');
      skipped.push({ row: excelRow, reason: 'перевод между своими счетами' });
      continue;
    }

    const type = amountSigned < 0 ? 'expense' : 'income';
    const amount = Math.abs(amountSigned);

    const mappedName = BANK_CATEGORY_TO_APP[bankCategory] || bankCategory;
    const comment = [description, bankCategory && mappedName !== bankCategory ? `(${bankCategory})` : '']
      .filter(Boolean)
      .join(' ')
      .trim();

    const item = {
      type,
      amount,
      date: dateStr,
      category: mappedName,
      comment: comment || description,
      currency,
    };
    if (isDebugImport()) logImport('  итог: В ИМПОРТ', JSON.stringify(item));
    items.push(item);
  }

  logImport('готово: items=', items.length, 'skipped=', skipped.length, 'errors=', errors.length);
  if (skipped.length && isDebugImport()) {
    logImport('пропуски:', JSON.stringify(skipped));
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
  pickCategoryColumnIndex,
  pickAmountOperationIndex,
  pickAmountPaymentIndex,
  isDebugImport,
};
