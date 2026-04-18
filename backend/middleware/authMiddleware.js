import { verifyAccessToken } from '../services/tokenService.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = verifyAccessToken(authHeader.slice(7));
      req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    } catch { /* ignore */ }
  }
  next();
}
