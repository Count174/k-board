const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authMiddleware = require('../middleware/authMiddleware');
const crypto = require('crypto');

// Генерация токена
router.post('/generate-token', authMiddleware, (req, res) => {
  const userId = req.userId;
  
  // Проверка на уже существующий активный токен
  db.get('SELECT token FROM telegram_tokens WHERE user_id = ? AND used = 0', [userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Ошибка запроса' });
    if (row) return res.json({ token: row.token });

    const token = crypto.randomBytes(16).toString('hex');
    db.run('INSERT INTO telegram_tokens (user_id, token, used) VALUES (?, ?, 0)', [userId, token], function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка генерации токена' });
      res.json({ token });
    });
  });
});

module.exports = router;