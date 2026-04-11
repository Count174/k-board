/** Парсинг даты для сценария /train (русские и числовые форматы). */
function parseDate(text) {
  const months = {
    января: 1,
    февраля: 2,
    марта: 3,
    апреля: 4,
    мая: 5,
    июня: 6,
    июля: 7,
    августа: 8,
    сентября: 9,
    октября: 10,
    ноября: 11,
    декабря: 12,
  };
  const today = new Date();
  const t = text.trim().toLowerCase();

  const matchNumeric = t.match(/^(\d{1,2})[./](\d{1,2})$/);
  if (matchNumeric) {
    const day = parseInt(matchNumeric[1], 10);
    const month = parseInt(matchNumeric[2], 10) - 1;
    const year =
      new Date(today.getFullYear(), month, day) < today
        ? today.getFullYear() + 1
        : today.getFullYear();
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const matchText = t.match(/^(\d{1,2})\s+([а-яё]+)/);
  if (matchText) {
    const day = parseInt(matchText[1], 10);
    const monthName = matchText[2];
    const month = months[monthName];
    if (!month) return null;
    const date = new Date(today.getFullYear(), month - 1, day);
    const year = date < today ? today.getFullYear() + 1 : today.getFullYear();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

module.exports = parseDate;
