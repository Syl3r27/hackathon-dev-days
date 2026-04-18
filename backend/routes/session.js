import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createSession, getSession, deleteSession } from '../services/sessionService.js';
import { v4 as uuidv4 } from 'uuid';

export const sessionRouter = Router();
sessionRouter.use(requireAuth);

sessionRouter.post('/init', async (req, res, next) => {
  try {
    const session = await createSession(req.user.id);
    res.json({ sessionId: session.sessionId, session });
  } catch (err) { next(err); }
});

sessionRouter.get('/:sessionId', async (req, res, next) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json({ session });
  } catch (err) { next(err); }
});

sessionRouter.delete('/:sessionId', async (req, res, next) => {
  try {
    await deleteSession(req.params.sessionId);
    res.json({ success: true });
  } catch (err) { next(err); }
});
