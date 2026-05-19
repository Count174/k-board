const crypto = require('crypto');
const db = require('../db/db');

const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC) || 60 * 30; // 30 min
const REFRESH_TTL_MS = Number(process.env.JWT_REFRESH_TTL_MS) || 30 * 24 * 60 * 60 * 1000; // 30 days

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'dev-only-jwt-secret-change-me';
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signAccessToken(userId) {
  const secret = getJwtSecret();
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      sub: String(userId),
      typ: 'access',
      iat: now,
      exp: now + ACCESS_TTL_SEC,
    })
  );
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const secret = getJwtSecret();
  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let body;
  try {
    body = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  } catch {
    return null;
  }

  if (body.typ !== 'access') return null;
  if (!body.sub || !body.exp) return null;
  if (body.exp < Math.floor(Date.now() / 1000)) return null;

  const userId = Number(body.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function ensureRefreshTokensSchema() {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function createRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
      [userId, tokenHash, expiresAt],
      (err) => {
        if (err) return reject(err);
        resolve(raw);
      }
    );
  });
}

function revokeRefreshToken(raw) {
  const tokenHash = hashToken(raw);
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL`,
      [tokenHash],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function revokeAllRefreshTokensForUser(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL`,
      [userId],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function consumeRefreshToken(raw) {
  const tokenHash = hashToken(raw);
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?`,
      [tokenHash],
      (err, row) => {
        if (err) return reject(err);
        if (!row || row.revoked_at) return resolve(null);
        if (new Date(row.expires_at) < new Date()) return resolve(null);

        db.run(
          `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [row.id],
          (err2) => {
            if (err2) return reject(err2);
            resolve(row.user_id);
          }
        );
      }
    );
  });
}

function issueTokenPair(userId) {
  return ensureRefreshTokensSchema().then(async () => {
    const accessToken = signAccessToken(userId);
    const refreshToken = await createRefreshToken(userId);
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL_SEC,
      tokenType: 'Bearer',
    };
  });
}

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function resolveUserIdFromRequest(req) {
  const bearer = extractBearerToken(req);
  if (bearer) {
    const fromJwt = verifyAccessToken(bearer);
    if (fromJwt) return fromJwt;
  }
  const cookieId = req.cookies?.userId;
  if (cookieId) {
    const n = Number(cookieId);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

module.exports = {
  ACCESS_TTL_SEC,
  ensureRefreshTokensSchema,
  signAccessToken,
  verifyAccessToken,
  issueTokenPair,
  createRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  consumeRefreshToken,
  extractBearerToken,
  resolveUserIdFromRequest,
};
