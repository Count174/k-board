# Mobile auth (iOS)

Веб по-прежнему использует cookie `userId`. iOS — JWT.

## Переменные окружения (backend)

```env
JWT_SECRET=<случайная_длинная_строка>
JWT_ACCESS_TTL_SEC=1800
JWT_REFRESH_TTL_MS=2592000000
```

На production `JWT_SECRET` обязателен.

## Миграция

```bash
node backend/db/migrate_mobile_auth.js
```

Таблица создаётся и при старте сервера (`ensureRefreshTokensSchema`).

## Поток iOS

1. `POST /api/auth/login` → `{ accessToken, refreshToken, expiresIn, user }`
2. Запросы: `Authorization: Bearer <accessToken>`
3. При 401 → `POST /api/auth/refresh` с `{ refreshToken }` → новая пара токенов
4. `POST /api/auth/logout` с `{ refreshToken }` при выходе

## Веб

Без изменений: `credentials: 'include'`, cookie выставляется при login/register.
