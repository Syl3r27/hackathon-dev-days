import { Router } from 'express';
import { register, login, refresh, me, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh', refresh);
authRouter.get('/me', requireAuth, me);
authRouter.post('/logout', requireAuth, logout);
