# o-board — гайд по редизайну

Перенос визуальной ревизии (см. макет «Дизайн-ревизия — Дашборд и Финансы») в код.
Папка `handoff/` зеркалит структуру репозитория — файлы можно класть на свои места.

---

## 1. Что меняем на уровне системы

| Проблема (как было) | Решение (как стало) |
|---|---|
| Два конкурирующих набора токенов (`--bg-0/1/2` и `--bg-app/panel/card`) | Один источник — `brand.css`. Старые имена оставлены как **алиасы**, код не ломается. |
| Литеральные хексы в модулях (`#86efac`, `#fbbf24`, `#4f46e5`…) | Семантические токены: `--bloom / --grow / --attention`, `--d-finance/-workout/-meds/-goals`. |
| 5–6 ярких доменных цветов на максимальной насыщенности | Доменные акценты с **едиными L и C**, различается только hue — различимы, но не шумят. |
| Глобальный градиент на **каждой** кнопке | Иерархия: `.btn-primary` (заливка) / `.btn-secondary` (обводка) / `.btn-ghost` (текст). |
| Эмодзи и кандзи как иконки (💰💊🌸 / 桜三銭花) | Единый линейный набор — `components/ui/Icon.jsx`. |
| Мелкий текст 11–12px низкого контраста | Нижняя граница вторичного текста 12.5–13px, `--text-mute` проходит AA. |
| Метафора сада только в эмодзи | Выражена визуально: «грядки» с уровнем «почвы» = здоровье направления; статусы цветёт/растёт/внимание. |

---

## 2. Установка (порядок важен)

1. Скопировать файлы из `handoff/` на свои места (перезаписать). Все 16 `.module.css` + фундамент уже готовы (§4).
2. Новый файл: `components/ui/Icon.jsx`.
3. В `pages/App.jsx` подключить токены **до** остальных стилей:
   ```js
   import '../styles/brand.css';   // ← добавить первой строкой стилей
   import '../styles/index.css';
   ```
4. Шрифт Newsreader подключается из `index.css` (`@import`). Если используете локальный хостинг шрифтов — добавьте Newsreader 400/500 рядом с Inter.

---

## 3. Карта замен (справочно — уже применено в готовых файлах)

Все `.module.css` в `handoff/` уже переведены по этой карте — она нужна, если будете править новые экраны.

### Поверхности и границы
```
#0a0d13 · #0a0f17 · rgba(11,18,32,…)      → var(--bg)
rgba(255,255,255,0.03)                     → var(--surf-1)
rgba(255,255,255,0.04–0.05)                → var(--surf-2)
rgba(255,255,255,0.12)                     → var(--line-2)
rgba(255,255,255,0.06–0.09)                → var(--line)
border-radius: 18px–20px                   → var(--r-xl)
border-radius: 16px                        → var(--r-lg)
border-radius: 12px                        → var(--r-md)
```

### Текст
```
#f8fafc · #eef2ff · #f1f5f9                → var(--text)
#cbd5e1 · #e2e8f0 · #b7c2d8                → var(--text-dim)
#64748b · #475569 · #94a3b8                → var(--text-mute)
```

### Статусы (заменить ВСЕ оттенки зелёного/жёлтого/бирюзового на семантику)
```
#86efac · #bbf7d0 · #10b981  (хорошо)      → var(--bloom)   / фон var(--bloom-bg)
#99f6e4 · #67e8f9            (средне)       → var(--grow)    / фон var(--grow-bg)
#fbbf24 · #fcd34d · #f97316  (внимание)     → var(--attention) / фон var(--att-bg)
```

### Кнопки (убрать поэлементные градиенты)
```
background: linear-gradient(130deg, #ec4899, #10b981)   → class .btn-primary
background: linear-gradient(180deg, …green…)            → class .btn-primary
светлая обводка/«вторичная»                              → class .btn-secondary
текстовая ссылка-кнопка                                  → class .btn-ghost
```

---

## 4. Точечные правки по экранам

Помимо токенов — конкретные структурные фиксы (видно в макете «После»):

### `DashboardHero` (Дашборд)
- Хедеро-«грядки» из pill’ов → **планторы** с заливкой по уровню (`height: score%`), цвет = статус. Это фирменная деталь.
- Эмодзи в «Фокусе дня» и «Сводке» → `<Icon name="…" />` (wallet, pill, activity).
- Прогресс-бары целей: убрать градиент `linear-gradient(90deg,#99f6e4,#f9a8d4)` → сплошной `background` цвета статуса.
- Понизить размеры подписей-хинтов до 12.5px минимум.

### `FinanceWidget` / `FinanceBoard` (Финансы)
- Большой `fHeroValue` 60px — оставить, но шрифт `var(--font-display)`; «волну» под hero убрать или заменить компактным **спарклайном** чистого потока.
- 6 разноцветных градиентных баров категорий → swatch + сплошная заливка из единой палитры (`--d-*` или серия hue одной L/C).
- Суммы операций 28px → 15px `tabular-nums`; иконки операций — `<Icon>` вместо эмодзи.
- Бюджет: показывать `% израсходовано` и `превышен на N%` (`--attention`) вместо обрезанной по 100% полоски.

### `GoalsWidget` (Цели)
- Эмодзи-бейджи 56px → `<Icon>` 34px в плитке статуса.
- Статус «офтрек» красным `#f87171` → `--attention` (без резкого красного).
- Добавить **тип-чип** (Накопление / Привычка / Рост / Снижение) — тип цели сейчас теряется.

## 4. Готовые файлы (drop-in) и что в них изменено

Все перечисленные `.module.css` **уже переписаны** и лежат в `handoff/` по своим путям —
класс-имена сохранены 1:1, JSX трогать не нужно (кроме правок в §5). Просто перезапишите.

| Файл | Статус | Ключевое |
|---|---|---|
| `styles/brand.css` | ✅ drop-in | единый источник токенов + алиасы |
| `styles/index.css` | ✅ drop-in | Newsreader + иерархия кнопок |
| `components/ui/Icon.jsx` | ✅ новый | линейные иконки |
| `components/layout/AppShell.{jsx,module.css}` | ✅ drop-in | меню: кандзи→иконки, группы, спокойный active |
| `components/Dashboard/DashboardHero.module.css` | ✅ drop-in | грядки-планторы, статус-заливка, читаемые подписи |
| `components/Dashboard/FinanceChartsRow.module.css` | ✅ drop-in | индиго hero→токены, сегменты |
| `components/FinanceWidget/FinanceWidget.module.css` | ✅ drop-in | `#2c2d35/#4f46e5`→токены |
| `components/BudgetWidget/BudgetWidget.module.css` | ✅ drop-in | sky/pink→токены, статус-бейджи |
| `styles/FinanceBoard.module.css` | ✅ drop-in | «волна» и 6 градиент-баров→единая палитра |
| `components/GoalsWidget/GoalsWidget.module.css` | ✅ drop-in | градиенты убраны, статусы-семантика |
| `styles/GoalsBoard.module.css` | ✅ drop-in | гипертрофир. шрифты уменьшены |
| `components/WorkoutsWidget/WorkoutsWidget.module.css` | ✅ drop-in | зелёные плашки→нейтральные, primary без градиента |
| `components/MedicationsWidget/MedicationsWidget.module.css` | ✅ drop-in | индиго→`--d-meds`, save→brand |
| `components/HealthWidget/HealthWidget.module.css` | ✅ drop-in | индиго→токены |
| `pages/HealthPage.module.css` | ✅ drop-in | WHOOP-карточка на токенах |
| `styles/TasksBoard.module.css` | ✅ drop-in | розовая addBtn→brand, шрифты |
| `components/ToDoWidget/ToDoWidget.module.css` | ✅ drop-in | индиго→токены, чек=bloom |
| `styles/SectionPage.module.css` | ✅ drop-in | двойной radial→single accent |

> Заметка по «грядкам»: `DashboardHero.module.css` готов к эффекту «почвы». Чтобы он
> появился, добавьте внутрь `.bed` элемент-заливку — см. §5.

---

## 5. JSX-правки (нужны вручную — небольшие)

CSS уже готов, но несколько вещей живут в разметке. Это весь список:

### 5.1 Убрать иероглиф `庭` — `pages/TasksPage.jsx:88` (обязательно)
```diff
- <h1 className={board.title}>Задачи 庭</h1>
+ <h1 className={board.title}>Задачи</h1>
```

### 5.2 Эмодзи `💊` → иконка — `components/MedicationsWidget/MedicationsWidget.jsx` (строки ~508 и ~554)
```diff
+ import Icon from "../ui/Icon";
  <div className={styles.itemTitle}>
-   💊 {it.name} <span className={styles.dosage}>{it.dosage}</span>
+   <Icon name="pill" size={16} /> {it.name} <span className={styles.dosage}>{it.dosage}</span>
  </div>
```
(`.itemTitle svg` уже стилизован под `--d-meds`.)

### 5.3 Эффект «почвы» у грядок — `components/Dashboard/DashboardHero.jsx` (опц., фирменная деталь)
В массиве `beds` уже есть `score` (0–1). В рендере грядки добавьте заливку и инлайн-цвет статуса:
```jsx
// цвет по порогам цветёт/растёт/внимание
const c = score >= 0.7 ? 'var(--bloom)' : score >= 0.4 ? 'var(--grow)' : 'var(--attention)';
<div className={styles.bed}>
  <span className={styles.bedSoil}
        style={{ height: `${Math.round(score*100)}%`,
                 background: `linear-gradient(180deg, ${c}22, ${c}14)` }} />
  {/* заголовок, % и статус — поверх (z-index уже задан) */}
</div>
```

### 5.4 Эмодзи-статусы целей → иконка + текст — `DashboardHero.jsx` (строки ~508–511, опц.)
Строки вида `'🌸 Цветёт' / '🌿 Растёт' / '⚠️ Внимание' / '🥀 Отстаёт'` — оставьте текст
без эмодзи (`'Цветёт'…`); цвет несёт класс `goalStatus_good/mid/bad`, который уже на токенах.
Остальные эмодзи в сводке (`💰`, `💊`) при желании замените на `<Icon>` по образцу §5.2 —
или оставьте: на читаемость и палитру они уже не влияют.

### 5.5 Кандзи-иконки навигации — **уже** решены в готовом `AppShell.jsx` (правок не нужно).

---

## 6. Порядок миграции (рекомендация)

1. `brand.css` + `index.css` + `App.jsx` (фундамент) → приложение сразу станет спокойнее за счёт алиасов.
2. `AppShell` (готов) → каркас и навигация.
3. Виджеты по одному: Здоровье (самый расходящийся) → Дашборд → Финансы → Цели → Тренировки → Задачи.
4. После миграции всех модулей — удалить блок алиасов в конце `brand.css`.
