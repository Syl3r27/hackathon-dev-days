import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_SECRET || 'relife-ai-dev-secret-change-in-production';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'relife-ai-refresh-dev-secret';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';

export function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

export function generateTokenPair(user) {
  const payload = { sub: user.id, email: user.email, name: user.name };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    expiresIn: 900 // 15 min in seconds
  };
}
