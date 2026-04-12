/**
 * Страница «переезд»: отдельная авторизация (MOVING_LOGIN / MOVING_PASSWORD в .env),
 * списки задач в backend/data/moving-todos.json
 */
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

const DATA_PATH = path.join(__dirname, '../data/moving-todos.json');
const SECTIONS = ['buy', 'kira', 'katya', 'other'];

function getSecret() {
  const s = process.env.MOVING_SESSION_SECRET || process.env.MOVING_PASSWORD;
  if (!s) return null;
  return crypto.createHash('sha256').update(String(s), 'utf8').digest();
}

function timingSafeEqualStr(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

function signSession() {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60; // 60 дней
  const payload = Buffer.from(JSON.stringify({ v: 1, exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySession(token) {
  const secret = getSecret();
  if (!secret || !token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function movingAuthMiddleware(req, res, next) {
  if (!process.env.MOVING_PASSWORD) {
    return res.status(503).json({ error: 'Страница не настроена (MOVING_PASSWORD в .env)' });
  }
  if (!verifySession(req.cookies.movingAuth)) {
    return res.status(401).json({ error: 'Нужна авторизация' });
  }
  next();
}

async function ensureDataDir() {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
}

function defaultTodos() {
  const o = {};
  SECTIONS.forEach((k) => {
    o[k] = [];
  });
  return o;
}

async function readTodos() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    const merged = defaultTodos();
    SECTIONS.forEach((k) => {
      if (Array.isArray(data[k])) merged[k] = data[k];
    });
    return merged;
  } catch {
    return defaultTodos();
  }
}

async function writeTodos(data) {
  await ensureDataDir();
  const merged = defaultTodos();
  SECTIONS.forEach((k) => {
    if (Array.isArray(data[k])) merged[k] = data[k];
  });
  await fs.writeFile(DATA_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

router.post('/login', (req, res) => {
  const login = process.env.MOVING_LOGIN || 'moving';
  const password = process.env.MOVING_PASSWORD;
  if (!password) {
    return res.status(503).json({ error: 'Сервер не настроен' });
  }
  const body = req.body || {};
  if (!timingSafeEqualStr(body.login || '', login) || !timingSafeEqualStr(body.password || '', password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = signSession();
  if (!token) return res.status(500).json({ error: 'Ошибка сессии' });
  res.cookie('movingAuth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('movingAuth', { path: '/' });
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  if (!process.env.MOVING_PASSWORD) {
    return res.json({ authenticated: false, configured: false });
  }
  res.json({
    configured: true,
    authenticated: verifySession(req.cookies.movingAuth),
  });
});

router.get('/todos', movingAuthMiddleware, async (req, res) => {
  try {
    const todos = await readTodos();
    res.json(todos);
  } catch (e) {
    console.error('moving GET todos:', e);
    res.status(500).json({ error: 'Не удалось прочитать список' });
  }
});

router.put('/todos', movingAuthMiddleware, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = defaultTodos();
    SECTIONS.forEach((k) => {
      if (!Array.isArray(body[k])) return;
      normalized[k] = body[k]
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          id: String(item.id || crypto.randomUUID()),
          text: String(item.text || '').slice(0, 2000),
          done: Boolean(item.done),
        }));
    });
    const saved = await writeTodos(normalized);
    res.json(saved);
  } catch (e) {
    console.error('moving PUT todos:', e);
    res.status(500).json({ error: 'Не удалось сохранить' });
  }
});

module.exports = router;
