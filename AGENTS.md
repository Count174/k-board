# K-Board / Oubaitori — контекст проекта

Единый технический и бизнес-контекст для быстрой работы над проектом. Для iOS-специфики см. [`ios/README.md`](ios/README.md), для мобильной авторизации — [`docs/MOBILE_AUTH.md`](docs/MOBILE_AUTH.md).

---

## 1. Что это за продукт

**Oubaitori** (бренд; домены `o-board.ru`, `oubaitori.ru`) — персональный кабинет жизни «цвести в своём ритме». Сводит в одном месте финансы, здоровье, тренировки и большие цели. Ключевая метафора — **сад**: чем лучше идут дела по направлениям, тем сильнее «цветёт» сад.

Основные пользовательские сценарии:
- Учёт **финансов** (доходы/расходы, счета, бюджеты по категориям, кредиты, накопления).
- **Здоровье**: приёмы добавок/медикаментов с напоминаниями, сон и восстановление (WHOOP), питание.
- **Тренировки**: расписание, планы, посещаемость, импорт из WHOOP.
- **Цели**: долгосрочные цели 4 типов с прогрессом и недельными чек-инами.
- **Аналитика**: составной скоринг здоровья/финансов/консистентности.
- **Telegram-бот**: напоминания и быстрый ввод данных из чата.
- **iOS-приложение** (SwiftUI) поверх того же API.

---

## 2. Архитектура (высокоуровнево)

| Слой | Технологии | Где |
|------|-----------|-----|
| Веб-фронт | React 18 + Vite, react-router (`basename="/app"`), CSS-модули | `frontend/` |
| Бэкенд | Node.js + Express, REST, порт **3002** | `backend/` |
| БД | **SQLite** (`backend/db/database.sqlite`), WAL | `backend/db/` |
| Мобайл | SwiftUI, MVVM, Keychain, URLSession | `ios/` |
| Лендинг | отдельный Vite-проект | `o-board-landing/` |
| Бот | `node-telegram-bot-api` (webhook или long polling) | `backend/bot/` |

- SPA смонтировано под **`/app`** (логин `/app/login`, дашборд `/app/dashboard`). Любые серверные редиректы должны вести на `/app/...`.
- Статику фронта в проде отдаёт **nginx** из `/var/www/k-board/html` (лендинг — `/var/www/o-board-landing/html`). Node отдаёт только API и часть статики (`public/assets/goals` и т.п.).
- Процесс держит **pm2** (app `k-board`).

---

## 3. Структура репозитория

```
k-board/
├── backend/            # Express API, бот, кроны, SQLite
│   ├── index.js        # bootstrap: схемы → app.listen(3002) → reminders → telegram
│   ├── routes/         # express-роутеры по доменам
│   ├── controllers/    # бизнес-логика доменов
│   ├── utils/          # сервисы (whoop, fx, push, accounts, budget, goalIcon, …)
│   ├── reminders/      # push+telegram напоминания (cron каждую минуту)
│   ├── bot/            # Telegram-бот: команды и cron-дайджесты
│   ├── db/             # init + миграции (migrate_*.js), database.sqlite (НЕ в git)
│   └── ecosystem.config.cjs  # pm2
├── frontend/           # React SPA (base /app)
│   └── src/{pages,components,api,styles,utils}
├── ios/                # SwiftUI-приложение (см. ios/README.md)
├── o-board-landing/    # лендинг
├── docs/               # MOBILE_AUTH, CEO_DASHBOARD_PLAN, openapi.yaml, ios/
├── public/             # favicon, assets/goals
├── scripts/deploy-prod.sh   # one-command deploy
└── AGENTS.md           # этот файл
```

---

## 4. Бэкенд: API-домены

Все роуты под `/api/*` (см. `backend/index.js`). Основные:

| Префикс | Назначение |
|---------|-----------|
| `/api/auth` | регистрация, логин, refresh, сброс пароля, `auth/me` |
| `/api/finances` | операции доходов/расходов, summary, импорт выписок |
| `/api/accounts` | счета (мультивалютные, дефолтный счёт) |
| `/api/budgets` | лимиты по категориям/общий, stats, suggestions |
| `/api/loans`, `/api/savings` | кредиты, накопления |
| `/api/categories` | категории расходов/доходов, merge |
| `/api/goals` | цели (CRUD + PATCH + чек-ины) |
| `/api/todos` | задачи |
| `/api/health`, `/api/daily-checks` | здоровье, ежедневные отметки (сон, тренировка) |
| `/api/medications` | приёмы добавок/лекарств + отметки приёма |
| `/api/nutrition` | питание |
| `/api/workouts` | планы/сессии тренировок |
| `/api/analytics` | составной скоринг (`analytics/score`) |
| `/api/whoop` | OAuth-интеграция WHOOP (status/connect/callback/disconnect) |
| `/api/onboarding` | состояние и применение онбординга |
| `/api/telegram` | генерация токена привязки (`generate-token`), вебхук бота |
| `/api/devices` | регистрация iOS push-устройств и преференсы |
| `/api/history`, `/api/moving`, `/api/ceo` | история, переезд, CEO-дашборд |

OpenAPI-черновик: `docs/openapi.yaml`.

---

## 5. Модель данных (SQLite)

Базовые таблицы (`backend/db/init.js`): `users`, `finances`, `todos`, `goals`, `health`, `buying_list`, `whoop_connections`, `whoop_oauth_states`, `whoop_daily_metrics`, `whoop_workout_imports`.

Доп. таблицы создаются миграциями (`backend/db/migrate_*.js`, идемпотентные `CREATE TABLE IF NOT EXISTS`, часть гоняется на старте):
- `refresh_tokens` (мобильная/refresh-авторизация)
- `accounts`, `categories`, `fx_rates`
- `goal_checkins` (+ расширение `goals`)
- `workout_settings`, `workout_plans`, `workout_exercises`, `workout_sessions`
- `push_devices`, `push_notification_log`
- `daily_checks`, `password_reset_tokens`

Схемы, которые поднимаются автоматически при старте (`index.js`): default-счета, `refresh_tokens`, `push_devices`, `goals`.

> ⚠️ **Прод-БД живёт только на сервере и НЕ отслеживается git** (`*.sqlite*` в `.gitignore`). Никогда не коммить `database.sqlite`. Перед любым `git pull`/`git checkout` на сервере — бэкап файла БД **за пределы репозитория**. Запланирован переезд на Postgres.

### Цели (важная бизнес-логика)
4 типа (`goal_type`), иконка подбирается автоматически из названия (`utils/goalIcon.js`, зеркало во `frontend/src/utils/goalIcon.js`):
- `task` — ✅ выполнить (выполнено/не выполнено, `is_completed`)
- `build_up` — 📈 прибавить (расти к `target`, `direction=increase`)
- `reduce` — 📉 избавиться (снижать значение, `direction=decrease`)
- `habit` — 🔁 привычка (N раз в неделю, недельные чек-ины)

---

## 6. Скоринг и «здоровье сада»

`backend/controllers/analyticsController.js` → `GET /api/analytics/score?start&end` возвращает по доменам (каждый 0–100):
- `breakdown.health.sleep` (сон), `breakdown.health.workouts` (план/посещаемость), `breakdown.health.meds` (принято/назначено)
- `breakdown.finance` (соблюдение бюджета по дням)
- `breakdown.consistency` (стрик: сон+финансы+вовлечённость)
- агрегаты `health` и `total`.

**Дашборд** (`frontend/src/components/Dashboard/DashboardHero.jsx`) показывает составную метрику «**Сегодня цветут X из Y**» — единый health-check по 4 «грядкам»: 💰 Финансы, 💪 Тренировки, 💊 Приёмы, 🌸 Цели. Каждая нормализуется к 0..1 (финансы/тренировки/приёмы — из `analytics/score` ÷100; цели — средний прогресс). Единые пороги: **≥0.7 цветёт** (зелёный), **≥0.4 растёт** (teal), иначе — **нужно внимание** (янтарный). Домены без данных не учитываются.

---

## 7. Авторизация

- JWT: **access** (по умолчанию 30 мин, `JWT_ACCESS_TTL_SEC`) + **refresh** (30 дней, `JWT_REFRESH_TTL_MS`, таблица `refresh_tokens`). Секрет — `JWT_SECRET` (в проде обязателен).
- Веб: httpOnly-cookie, `credentials: 'include'`, `trust proxy` за nginx.
- Мобайл: те же токены, хранятся в Keychain. Детали — `docs/MOBILE_AUTH.md`.

---

## 8. Интеграции

### Telegram-бот (`backend/bot/`)
- Два режима: **webhook** (по умолчанию) и **long polling** (`TELEGRAM_USE_POLLING=1` — спасает, когда РФ-VPS не достаёт `api.telegram.org`).
- Можно отключить бота на инстансе: `TELEGRAM_BOT_ENABLED=0`.
- Привязка аккаунта: `POST /api/telegram/generate-token` → пользователь шлёт `/connect <token>` боту. Модалка с токеном — `frontend/src/components/TelegramModal.jsx` (открывается из профиля в сайдбаре `AppShell` и из шага онбординга). Бот: `@whoiskiryabot`.
- Диагностика: `GET /api/telegram/bot-ready`. Регистрация вебхука с ноута: `backend/scripts/setTelegramWebhook.cjs`.
- Кроны бота (`registerBot.js`): недельный чек-ин целей, бюджет-алерты, дайджесты, WHOOP-дайджест, синки.

### WHOOP (`backend/utils/whoopService.js`, `backend/routes/whoop.js`)
- OAuth2 (`api.prod.whoop.com`). Scopes из `WHOOP_SCOPES`, всегда добавляется `offline`.
- **Ротация refresh-токенов**: при обновлении в теле запроса **обязателен `scope=offline`**, иначе refresh-токен не продлевается и интеграция отваливается ~раз в 2 недели. Новый refresh-токен сохраняется в `saveConnection`.
- `GET /api/whoop/status` возвращает `connected` и `needs_reauth` (распознаёт протухшую сессию по auth-ошибке) + последний `recovery`.
- Реконнект перезаписывает токены через тот же OAuth-флоу; история `whoop_daily_metrics` сохраняется.
- Callback редиректит на **`/app/dashboard?whoop=connected|failed`** (env `WHOOP_SUCCESS_REDIRECT`/`WHOOP_FAIL_REDIRECT`; дефолт уже `/app/...`).
- UI статуса/подключения — в карточке «Здоровье» на дашборде.

### Push (APNs, `backend/utils/pushService.js`)
- token-based APNs (`APNS_KEY_ID/TEAM_ID/KEY_PATH`, `APNS_BUNDLE_ID` по умолч. `ru.oubaitori.app`, `APNS_ENV`).
- Устройства/преференсы — `/api/devices`, таблицы `push_devices`/`push_notification_log`.
- На бесплатном Apple-аккаунте push-capability отключается флагом `ENABLE_PUSH=False` в `ios/scripts/generate_xcodeproj.py`.

### Прочее
- **FX** (`utils/fxService.js`): курсы валют, конвертация в рубли (`amount_rub`).
- **Импорт выписок** Tinkoff (`utils/tinkoffStatement.js`).
- **Email** (`utils/emailService.js`): SMTP, сброс пароля.

---

## 9. Напоминания (`backend/reminders/`)

`startReminderSchedules()` (вызывается из `index.js`), таймзона **Europe/Moscow**:
- медикаменты — каждую минуту (`runMedicationReminders`)
- тренировки — каждую минуту (`runWorkoutReminders`)
- расходы — ежедневно 19:30 (`runExpenseReminders`)

Доставка: push (APNs) + Telegram. Диспетчер — `reminders/dispatcher.js`.

---

## 10. Онбординг

- Визард: `frontend/src/components/OnboardingProvider/OnboardingWizard.jsx`, состояние — `OnboardingProvider.jsx`.
- Шаги: `welcome → training → meds → goals → budget → bot → finish`.
- Прогресс копится в `payload_json` (`POST /api/onboarding/state`), всё применяется разом в `POST /api/onboarding/complete` (`backend/controllers/onboardingController.js`): тренировки в `health`, курсы в `medications`, цели в `goals` (с `goal_type`/`direction`), лимиты в `budgets`.
- Шаг Telegram сразу показывает токен; цели используют новую систему типов; медикаменты — «быстрое добавление» (расписание под тоглом).

---

## 11. Деплой и эксплуатация

One-command деплой — `scripts/deploy-prod.sh` (commit → push → remote `git pull --ff-only` → сборка фронта/лендинга при изменениях → sync в `/var/www/...` → `pm2 restart`):

```bash
npm run deploy:prod -- -m "feat: сообщение"
npm run deploy:prod:skip-commit         # если уже закоммичено/запушено
```

Параметры через env (`DEPLOY_SSH`, `DEPLOY_REMOTE_DIR`, `DEPLOY_PM2_APP`, `DEPLOY_WWW_DIR`, `DEPLOY_LANDING_WWW_DIR`).

Ручная сборка фронта на сервере:
```bash
cd <repo>/frontend && npm install && npm run build
sudo rm -rf /var/www/k-board/html/* && sudo cp -a dist/. /var/www/k-board/html/
sudo chown -R www-data:www-data /var/www/k-board/html
```

### Операционные правила (важно)
- **`node_modules` и `*.sqlite*` не в git.** На сервере `npm install` пересобирает нативные модули (`sqlite3`, и т.п.) под версию Node — при ABI-ошибках `rm -rf node_modules && npm install`.
- **Перед `git pull`/`git checkout` на сервере — бэкап `database.sqlite` наружу репозитория.** `git pull` может удалить файл, который перестал отслеживаться.
- Изменения в `.env` требуют `pm2 restart`.

---

## 12. Переменные окружения (`backend/.env`)

| Переменная | Назначение |
|-----------|-----------|
| `JWT_SECRET` | подпись токенов (обязателен в проде) |
| `JWT_ACCESS_TTL_SEC`, `JWT_REFRESH_TTL_MS` | TTL токенов |
| `BOT_TOKEN` | Telegram-бот |
| `TELEGRAM_BOT_ENABLED` | `0` — не поднимать бота на инстансе |
| `TELEGRAM_USE_POLLING` | `1` — long polling вместо вебхука |
| `TELEGRAM_WEBHOOK_BASE_URL`, `TELEGRAM_WEBHOOK_PATH` | вебхук |
| `TELEGRAM_HTTPS_PROXY` / `HTTPS_PROXY` | прокси для бота |
| `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REDIRECT_URI` | OAuth WHOOP |
| `WHOOP_SCOPES` | scopes (offline добавляется автоматически) |
| `WHOOP_SUCCESS_REDIRECT`, `WHOOP_FAIL_REDIRECT` | редиректы (дефолт `/app/dashboard?...`) |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_PATH`, `APNS_BUNDLE_ID`, `APNS_ENV` | push |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`, `SMTP_SECURE` | почта |
| `FRONTEND_URL` | базовый URL для ссылок (сброс пароля) |
| `MOVING_LOGIN`, `MOVING_PASSWORD`, `MOVING_SESSION_SECRET` | раздел «переезд» |
| `CEO_SECRET`, `CEO_TELEGRAM_BOT_TOKEN`, `CEO_TELEGRAM_CHAT_ID` | CEO-дашборд/алерты |
| `NODE_ENV` | окружение |

---

## 13. Домены и CORS

Разрешённые origin (`backend/index.js`): `oubaitori.ru`, `www.oubaitori.ru`, `o-board.ru`, `www.o-board.ru`, `k-board.whoiskirya.ru` (временно). Bundle iOS: `ru.oubaitori.app`.

---

## 14. Известные нюансы / TODO

- Переезд SQLite → **PostgreSQL** (запланирован).
- `frontend/src/components/Dashboard/GreetingsHeader.jsx` — легаси, не рендерится (его функции перенесены в `AppShell`/`DashboardHero`).
- Сборка фронта в песочнице IDE-агента может падать на нативном `rollup`/`esbuild` (системная политика) — собирать на сервере при деплое.
- Локально нельзя коммитить/деплоить от имени агента без явного разрешения; пуш делает владелец или по запросу.
