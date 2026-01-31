# Настройка отправки email

## Установка зависимостей

```bash
cd backend
npm install nodemailer bcrypt
```

## Настройка переменных окружения

Создайте файл `.env` в папке `backend/` (если его еще нет) и добавьте следующие переменные:

```env
# SMTP настройки
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com

# URL фронтенда (для ссылок в письмах)
FRONTEND_URL=https://your-domain.com
```

## Настройка для разных провайдеров

### Gmail

1. Включите двухфакторную аутентификацию в Google аккаунте
2. Создайте "Пароль приложения":
   - Перейдите в [Настройки аккаунта Google](https://myaccount.google.com/)
   - Безопасность → Двухэтапная аутентификация → Пароли приложений
   - Создайте пароль для "Почта" и "Другое устройство"
   - Используйте этот пароль в `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # Пароль приложения (16 символов)
EMAIL_FROM=your-email@gmail.com
```

### Yandex

```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yandex.ru
SMTP_PASS=your-password
EMAIL_FROM=your-email@yandex.ru
```

### Mail.ru

```env
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@mail.ru
SMTP_PASS=your-password
EMAIL_FROM=your-email@mail.ru
```

### SendGrid (рекомендуется для продакшена)

1. Зарегистрируйтесь на [SendGrid](https://sendgrid.com/)
2. Создайте API ключ
3. Используйте SMTP настройки:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@your-domain.com
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASS=your-mailgun-password
EMAIL_FROM=noreply@your-domain.com
```

## Запуск миграции

Перед использованием функций восстановления пароля необходимо создать таблицу для токенов:

```bash
cd backend/db
node migrate_password_reset.js
```

## Проверка работы

После настройки можно протестировать отправку email, вызвав функцию восстановления пароля через API или веб-интерфейс.

## Безопасность

- **Никогда не коммитьте `.env` файл в git**
- Используйте сильные пароли приложений
- Для продакшена рекомендуется использовать специализированные сервисы (SendGrid, Mailgun, AWS SES)
- Токены восстановления пароля действительны 1 час
- Токены можно использовать только один раз

## Troubleshooting

### Ошибка "Email не настроен"
- Проверьте, что все переменные окружения установлены
- Убедитесь, что файл `.env` находится в папке `backend/`
- Перезапустите сервер после изменения `.env`

### Ошибка авторизации SMTP
- Для Gmail: убедитесь, что используете пароль приложения, а не обычный пароль
- Проверьте, что двухфакторная аутентификация включена (для Gmail)
- Проверьте правильность порта и настройки `SMTP_SECURE`

### Письма не доходят
- Проверьте папку "Спам"
- Убедитесь, что `FRONTEND_URL` указан правильно
- Проверьте логи сервера на наличие ошибок отправки
