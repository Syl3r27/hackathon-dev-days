import { createUser, validatePassword, findUserById } from '../services/userService.js';
import { generateTokenPair, verifyRefreshToken, signAccessToken } from '../services/tokenService.js';
import { catchAsync } from '../utils/catchAsync.js';

export const register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email?.includes('@')) return res.status(400).json({ error: 'Valid email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const user = await createUser({ name, email, password });
  const tokens = generateTokenPair(user);

  res.status(201).json({
    message: 'Account created successfully',
    user: { id: user.id, name: user.name, email: user.email },
    ...tokens
  });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await validatePassword(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const tokens = generateTokenPair(user);

  res.json({
    message: 'Login successful',
    user: { id: user.id, name: user.name, email: user.email },
    ...tokens
  });
});

export const refresh = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token', code: 'REFRESH_EXPIRED' });
  }

  const user = await findUserById(decoded.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
  res.json({ accessToken, expiresIn: 900 });
});

export const me = catchAsync(async (req, res, next) => {
  const user = await findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

export const logout = catchAsync(async (req, res) => {
  res.json({ message: 'Logged out successfully' });
});
