// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/db');
const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (row) return res.status(409).json({ error: 'Пользователь уже существует' });

    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash], function (err) {
      if (err) return res.status(500).json({ error: 'Ошибка при регистрации' });
      res.status(201).json({ success: true, userId: this.lastID });
    });
  });
});

// Логин
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (!user) return res.status(401).json({ error: 'Неверные данные' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });

    res.cookie('userId', user.id, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ success: true, userId: user.id });
  });
});

// Выход
router.post('/logout', (req, res) => {
  res.clearCookie('userId');
  res.json({ success: true });
});

// Получение инфы о пользователе
router.get('/me', (req, res) => {
    const userId = req.cookies?.userId;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
  
    db.get('SELECT id, email FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      if (!row) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({ id: row.id, email: row.email });
    });
  });

module.exports = router;