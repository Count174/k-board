# Push-уведомления (фаза 4)

Планируется замена Telegram-напоминаний:

- Тренировки: локальный или серверный push по `workout_settings.notify_time`
- Лекарства: по `medications.times`
- Backend: `POST /api/devices` с APNs device token

Требуется Apple Push Notification service key в backend и capability Push Notifications в Xcode.
