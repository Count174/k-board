const WHOOP_SLEEP_KEYWORDS = [
  'сон', 'спать', 'высыпа', 'режим сна', 'часов сна', 'sleep',
];

const WHOOP_RECOVERY_KEYWORDS = [
  'восстановлен', 'recovery', 'whoop',
];

const WORKOUT_KEYWORDS = [
  'трениров', 'спортзал', 'зал ', 'тренировок', 'занятий в зале',
  'занятий', 'workout', 'gym',
];

// Each entry: { keywords, category } — matched against title to suggest a finance category
const FINANCE_RULES = [
  { keywords: ['кофе'], category: 'кофе' },
  { keywords: ['рестор', 'кафе'], category: 'рестораны' },
  { keywords: ['такси', 'uber'], category: 'такси' },
  { keywords: ['продукт', 'еда', 'groceri'], category: 'продукты' },
  { keywords: ['кино', 'театр', 'концерт'], category: 'развлечения' },
  { keywords: ['транспорт', 'метро', 'автобус'], category: 'транспорт' },
  { keywords: ['подписк', 'subscription'], category: 'подписки' },
  { keywords: ['алкогол', 'пиво', 'вино', 'бар'], category: 'алкоголь' },
  { keywords: ['одежд', 'шопинг'], category: 'одежда' },
  { keywords: ['расход', 'трат', 'покупк', 'spend', 'expense', 'бюджет на'], category: null },
];

/** Returns a suggestion object or null. */
export function detectSource(title) {
  const t = String(title || '').toLowerCase().trim();
  if (t.length < 3) return null;

  for (const kw of WHOOP_SLEEP_KEYWORDS) {
    if (t.includes(kw)) {
      return {
        source_type: 'whoop_sleep',
        source_aggregation: 'mean',
        label: 'WHOOP: сон',
        unit_hint: 'ч',
      };
    }
  }

  for (const kw of WHOOP_RECOVERY_KEYWORDS) {
    if (t.includes(kw)) {
      return {
        source_type: 'whoop_recovery',
        source_aggregation: 'mean',
        label: 'WHOOP: восстановление',
        unit_hint: '%',
      };
    }
  }

  for (const kw of WORKOUT_KEYWORDS) {
    if (t.includes(kw)) {
      return {
        source_type: 'workouts',
        source_aggregation: 'sum',
        label: 'тренировки',
        unit_hint: 'раз',
      };
    }
  }

  for (const rule of FINANCE_RULES) {
    for (const kw of rule.keywords) {
      if (t.includes(kw)) {
        return {
          source_type: 'finance_category',
          source_aggregation: 'sum',
          label: rule.category ? `расходы: ${rule.category}` : 'расходы',
          suggested_category: rule.category || '',
          unit_hint: '₽',
        };
      }
    }
  }

  return null;
}

export const SOURCE_LABELS = {
  whoop_sleep: 'WHOOP сон',
  whoop_recovery: 'WHOOP восстановление',
  workouts: 'тренировки',
  finance_category: 'расходы',
};
