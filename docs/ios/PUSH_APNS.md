# Push-уведомления (APNs)

Серверные напоминания для iOS (параллельно с Telegram):

| Тип | Расписание (Europe/Moscow) | Условие |
|-----|---------------------------|---------|
| Лекарства / витамины | каждую минуту | `medications.times`, `shouldNotifyToday` |
| Тренировки | каждую минуту | `workout_settings.notify_time`, pending sessions |
| Расходы | 19:30 | нет ни одной записи в `finances` за сегодня |

## Apple Developer

1. Certificates, Identifiers & Profiles → Keys → **APNs Auth Key** (.p8).
2. Сохранить **Key ID** и **Team ID**.
3. В Xcode: target Oubaitori → Signing & Capabilities → **Push Notifications** (entitlements генерируются в `Oubaitori.entitlements`).

## Backend `.env`

```env
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=XXXXXXXXXX
APNS_KEY_PATH=/secure/path/AuthKey_XXXXXXXXXX.p8
APNS_BUNDLE_ID=ru.oubaitori.app
# sandbox — debug-сборка на устройстве
# production — TestFlight / App Store
APNS_ENV=sandbox
```

Файл `.p8` **не коммитить** в git.

## Миграция БД

```bash
node backend/db/migrate_push_devices.js
```

Таблицы: `push_devices`, `push_notification_log`.

## API (JWT)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/devices` | `{ deviceToken, environment, platform }` |
| DELETE | `/api/devices` | `{ deviceToken }` |
| GET/PATCH | `/api/devices/preferences` | мастер-тумблер и типы |

## Тестовый push

```bash
node backend/scripts/sendTestPush.js <userId> "Заголовок" "Текст"
```

Перед этим: пользователь залогинен в приложении, разрешены уведомления, токен записан в `push_devices`.

## Sandbox vs Production

| Сборка | `APNS_ENV` на сервере | Токен устройства |
|--------|----------------------|------------------|
| Debug на iPhone | `sandbox` | sandbox |
| TestFlight / App Store | `production` | production |

Неверный `APNS_ENV` → push не доходят (тишина, без ошибки в UI).

В `Oubaitori.entitlements` для релиза в App Store Connect профиль подставит `production`; для локальной отладки — `development`.

## iOS

- `PushNotificationService` — разрешение, регистрация, `POST /api/devices` после login.
- `AppDelegate` — device token.
- Tap по уведомлению → `screen`: `medications` | `workout` | `finance`.
- Профиль → **Уведомления** — типы и синхронизация с сервером.

Перегенерация Xcode-проекта после новых Swift-файлов:

```bash
python3 ios/scripts/generate_xcodeproj.py
```

Затем в Xcode задать **DEVELOPMENT_TEAM** и включить Push capability при необходимости.

## Деплой чеклист

- [ ] `.p8` на сервере, права чтения у процесса Node
- [ ] `APNS_ENV` совпадает со способом установки приложения
- [ ] `node backend/db/migrate_push_devices.js` на проде
- [ ] `pm2 restart` (или аналог) после обновления кода
- [ ] Логи: `[reminders] push schedules started`
- [ ] Тест: `sendTestPush.js` + реальное напоминание (лекарство с временем «сейчас»)
- [ ] Logout удаляет token (`DELETE /api/devices`)
- [ ] Telegram по-прежнему работает для пользователей с `telegram_users`

## Модули backend

- `backend/utils/pushService.js` — отправка APNs
- `backend/reminders/dispatcher.js` — Telegram + push
- `backend/reminders/schedule.js` — cron (подключается в `index.js`)

Cron в `registerBot.js` / `workoutPlanBot.js` для этих напоминаний **отключены** — единая точка в `reminders/`.
