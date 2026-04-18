import { Router } from 'express';
import { synthesizeSpeech, voiceStatus, voices } from '../controllers/voiceController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const voiceRouter = Router();

// Status is public so frontend can check availability without auth
voiceRouter.get('/status', voiceStatus);

// Synthesis and voice list require auth
voiceRouter.post('/synthesize', requireAuth, synthesizeSpeech);
voiceRouter.get('/voices', requireAuth, voices);
