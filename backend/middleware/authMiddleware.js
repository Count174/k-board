function authMiddleware(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  req.userId = req.session.userId;
  next();
}

module.exports = authMiddleware;