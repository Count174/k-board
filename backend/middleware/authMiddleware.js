function authMiddleware(req, res, next) {
  const userId = req.cookies.userId;
  if (!userId) return res.status(401).json({ error: 'Не авторизован' });
  req.userId = userId;
  next();
}

module.exports = authMiddleware;