import { Router } from 'express';
import { analyzeItem, getRepairStep, continueConversation, completeAction } from '../controllers/analysisController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const analysisRouter = Router();

analysisRouter.use(requireAuth);
analysisRouter.post('/analyze', analyzeItem);
analysisRouter.post('/repair-step', getRepairStep);
analysisRouter.post('/continue', continueConversation);
analysisRouter.post('/complete', completeAction);
