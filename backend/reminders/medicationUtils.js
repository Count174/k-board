/** Shared medication schedule helpers (Moscow TZ crons). */

function shouldNotifyToday(frequency, now = new Date()) {
  if (!frequency || frequency === 'daily') return true;

  if (frequency.startsWith('dow:')) {
    const set = new Set(
      frequency
        .slice(4)
        .split(',')
        .map((x) => parseInt(x, 10))
        .filter(Boolean)
    );
    const dow = ((now.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
    return set.has(dow);
  }

  return false;
}

function moscowNowParts() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    today: `${get('year')}-${get('month')}-${get('day')}`,
    hhmm: `${get('hour')}:${get('minute')}`,
  };
}

module.exports = { shouldNotifyToday, moscowNowParts };
