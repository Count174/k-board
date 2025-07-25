// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/db');
const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (row) return res.status(409).json({ error: 'Пользователь уже существует' });

    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash], function (err) {
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

    req.session.userId = user.id;
    res.json({ success: true });
  });
});

// Выход
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Получение инфы о пользователе
router.get('/me', (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
  
    db.get('SELECT id, name, email FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      if (!row) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({ id: row.id, email: row.email, name: row.name });
    });
  });

module.exports = router;