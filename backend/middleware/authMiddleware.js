const { resolveUserIdFromRequest } = require('../utils/authTokens');

function authMiddleware(req, res, next) {
  const userId = resolveUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Не авторизован' });
  req.userId = userId;
  next();
}

module.exports = authMiddleware;
