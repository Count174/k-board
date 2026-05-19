// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db/db');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require('../utils/emailService');
const { notifyNewUser } = require('../utils/ceoTelegram');
const { ensureDefaultAccountForUser } = require('../utils/accountsService');
const {
  issueTokenPair,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  ensureRefreshTokensSchema,
  resolveUserIdFromRequest,
} = require('../utils/authTokens');

const COOKIE_OPTS = {
  httpOnly: false,
  secure: true,
  sameSite: 'None',
  maxAge: 14 * 24 * 60 * 60 * 1000,
  path: '/',
};

function setWebSessionCookie(res, userId) {
  res.cookie('userId', userId, COOKIE_OPTS);
}

async function attachMobileTokens(res, userId) {
  await ensureRefreshTokensSchema();
  return issueTokenPair(userId);
}

async function authSuccessResponse(res, user, statusCode = 200) {
  setWebSessionCookie(res, user.id);
  const tokens = await attachMobileTokens(res, user.id);
  return res.status(statusCode).json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email },
    ...tokens,
  });
}

// Регистрация
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }
  // name не обязателен, но заполним хотя бы чем-то
  const safeName = (name && String(name).trim()) || String(email).split('@')[0];

  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (row) return res.status(409).json({ error: 'Пользователь уже существует' });

    try {
      const hash = await bcrypt.hash(password, 10);
      db.run(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [safeName, email, hash],
        async function (err2) {
          if (err2) return res.status(500).json({ error: 'Ошибка при регистрации' });
          try {
            await ensureDefaultAccountForUser(this.lastID);
          } catch (accErr) {
            console.error('register default account error:', accErr);
          }

          notifyNewUser(safeName, email).catch(() => {});

          authSuccessResponse(
            res,
            { id: this.lastID, name: safeName, email },
            201
          ).catch((e) => {
            console.error('register tokens error:', e);
            res.status(500).json({ error: 'Ошибка при регистрации' });
          });
        }
      );
    } catch (e) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
});

// Логин
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email и пароль обязательны' });

  db.get('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!user) return res.status(401).json({ error: 'Неверные данные' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });

    authSuccessResponse(res, user).catch((e) => {
      console.error('login tokens error:', e);
      res.status(500).json({ error: 'Ошибка сервера' });
    });
  });
});

// Обновление access-токена (iOS)
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken обязателен' });
  }

  try {
    await ensureRefreshTokensSchema();
    const userId = await consumeRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({ error: 'Недействительный refresh-токен' });
    }

    db.get('SELECT id, name, email FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

      setWebSessionCookie(res, user.id);
      try {
        const tokens = await issueTokenPair(user.id);
        return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email }, ...tokens });
      } catch (e) {
        console.error('refresh tokens error:', e);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
    });
  } catch (e) {
    console.error('refresh error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Выход (веб cookie + опционально refresh для mobile)
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body || {};
  res.clearCookie('userId', { path: '/' });

  const userId = resolveUserIdFromRequest(req);
  try {
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    } else if (userId) {
      await revokeAllRefreshTokensForUser(userId);
    }
  } catch (e) {
    console.error('logout revoke error:', e);
  }

  res.json({ success: true });
});

// Получение инфы о пользователе
router.get('/me', authMiddleware, (req, res) => {
  db.get('SELECT id, name, email FROM users WHERE id = ?', [req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!row) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(row);
  });
});

/**
 * POST /auth/forgot-password
 * Запрос на восстановление пароля
 */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email обязателен' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Ищем пользователя
  db.get('SELECT id, email FROM users WHERE email = ?', [normalizedEmail], async (err, user) => {
    if (err) {
      console.error('Ошибка поиска пользователя:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    // Всегда возвращаем успех, даже если пользователь не найден (защита от перебора)
    if (!user) {
      console.log(`⚠️ Попытка восстановления пароля для несуществующего email: ${normalizedEmail}`);
      return res.json({ 
        success: true, 
        message: 'Если пользователь с таким email существует, на него будет отправлено письмо' 
      });
    }

    // Генерируем токен
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час

    // Сохраняем токен в БД
    db.run(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, token, expiresAt.toISOString()],
      async (err) => {
        if (err) {
          console.error('Ошибка сохранения токена:', err);
          return res.status(500).json({ error: 'Ошибка сервера' });
        }

        // Формируем URL для сброса пароля
        const baseUrl = process.env.FRONTEND_URL || req.protocol + '://' + req.get('host');
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;

        // Отвечаем сразу, чтобы не получить 504 при медленной/недоступной почте
        res.json({
          success: true,
          message: 'Если пользователь с таким email существует, на него будет отправлено письмо',
        });

        // Отправляем email в фоне (не блокируем ответ)
        sendPasswordResetEmail(user.email, token, resetUrl)
          .then((emailResult) => {
            if (!emailResult.success) {
              console.error('Ошибка отправки email восстановления пароля:', emailResult.error);
            }
          })
          .catch((e) => {
            console.error('Ошибка отправки email восстановления пароля:', e);
          });
      }
    );
  });
});

/**
 * POST /auth/reset-password
 * Сброс пароля по токену
 */
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Токен и пароль обязательны' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
  }

  // Ищем токен
  db.get(
    `SELECT prt.user_id, prt.expires_at, prt.used, u.email
     FROM password_reset_tokens prt
     JOIN users u ON prt.user_id = u.id
     WHERE prt.token = ?`,
    [token],
    async (err, row) => {
      if (err) {
        console.error('Ошибка поиска токена:', err);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }

      if (!row) {
        return res.status(400).json({ error: 'Неверный или истекший токен' });
      }

      // Проверяем, не использован ли токен
      if (row.used === 1) {
        return res.status(400).json({ error: 'Токен уже использован' });
      }

      // Проверяем срок действия
      const expiresAt = new Date(row.expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: 'Токен истек' });
      }

      // Хешируем новый пароль
      try {
        const hash = await bcrypt.hash(password, 10);

        // Обновляем пароль
        db.run(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [hash, row.user_id],
          (err) => {
            if (err) {
              console.error('Ошибка обновления пароля:', err);
              return res.status(500).json({ error: 'Ошибка сервера' });
            }

            // Помечаем токен как использованный
            db.run(
              'UPDATE password_reset_tokens SET used = 1 WHERE token = ?',
              [token],
              (err) => {
                if (err) {
                  console.error('Ошибка обновления токена:', err);
                }
              }
            );

            // Отправляем уведомление на email
            sendPasswordChangedEmail(row.email).catch(err => {
              console.error('Ошибка отправки уведомления:', err);
            });

            res.json({ success: true, message: 'Пароль успешно изменен' });
          }
        );
      } catch (e) {
        console.error('Ошибка хеширования пароля:', e);
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
    }
  );
});

/**
 * POST /auth/change-password
 * Смена пароля для авторизованного пользователя
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Текущий и новый пароль обязательны' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' });
  }

  // Получаем пользователя
  db.get('SELECT id, password_hash, email FROM users WHERE id = ?', [req.userId], async (err, user) => {
    if (err) {
      console.error('Ошибка поиска пользователя:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем текущий пароль
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    // Хешируем новый пароль
    try {
      const hash = await bcrypt.hash(newPassword, 10);

      // Обновляем пароль
      db.run(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hash, user.id],
        (err) => {
          if (err) {
            console.error('Ошибка обновления пароля:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }

          // Отправляем уведомление на email
          sendPasswordChangedEmail(user.email).catch(err => {
            console.error('Ошибка отправки уведомления:', err);
          });

          res.json({ success: true, message: 'Пароль успешно изменен' });
        }
      );
    } catch (e) {
      console.error('Ошибка хеширования пароля:', e);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
});

module.exports = router;