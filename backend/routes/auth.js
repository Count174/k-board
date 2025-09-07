// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/db');
const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
  let { name, email, password } = req.body || {};
  email = String(email || '').trim().toLowerCase();
  name = String(name || '').trim();

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
  }

  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (row) return res.status(409).json({ error: 'Пользователь уже существует' });

    try {
      const hash = await bcrypt.hash(password, 10);

      // ЯВНО указываем столбцы в порядке их существования в БД
      // users: id | email | password_hash | created_at | name
      db.run(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        [email, hash, name],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({ error: 'Ошибка при регистрации' });
          }
          // Можно сразу залогинить (по желанию):
          res.cookie('userId', this.lastID, {
            httpOnly: false,
            secure: true,
            sameSite: 'None',
            maxAge: 14 * 24 * 60 * 60 * 1000,
            path: '/',
          });
          res.status(201).json({ success: true, userId: this.lastID });
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

    res.cookie('userId', user.id, {
      httpOnly: false,
      secure: true,
      sameSite: 'None',
      maxAge: 14 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ success: true });
  });
});

// Выход
router.post('/logout', (req, res) => {
  res.clearCookie('userId', { path: '/' });
  res.json({ success: true });
});

// Получение инфы о пользователе
router.get('/me', (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) return res.status(401).json({ error: 'Не авторизован' });

  db.get('SELECT id, name, email FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!row) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(row);
  });
});

module.exports = router;