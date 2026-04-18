import { analyzeImageWithGemini, generateDecisionsWithGemini, generateRepairStepDetail } from '../services/geminiService.js';
import { createSession, getSession, updateSession } from '../services/sessionService.js';
import { updateUserStats } from '../services/userService.js';
import { v4 as uuidv4 } from 'uuid';

// POST /api/analysis/analyze
export async function analyzeItem(req, res, next) {
    try {
        const { imageBase64, mimeType, userMessage, sessionId: existingSessionId } = req.body;
        if (!imageBase64) return res.status(400).json({ error: 'Image data required' });

        const sessionId = existingSessionId || uuidv4();
        let session = await getSession(sessionId).catch(() => null);
        if (!session) session = await createSession(req.user.id).catch(() => ({ sessionId, userId: req.user.id, conversationHistory: [], visualAnalyses: [] }));

        // Visual Understanding ──────────────────────────────────
        const visualAnalysis = await analyzeImageWithGemini(imageBase64, mimeType || 'image/jpeg');

        // Decision Engine ───────────────────────────────────────
        const message = userMessage || `Please analyze my ${visualAnalysis.objectType || 'item'} and recommend the most sustainable course of action.`;
        const decisions = await generateDecisionsWithGemini(visualAnalysis, session.conversationHistory || [], message);

        //  Persist ──────────────────────────────────────────────────────────────
        const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
        const assistantMsg = { role: 'assistant', content: `Recommendation: ${decisions.recommendation}. ${decisions.recommendationReason}`, timestamp: new Date().toISOString() };
        const updatedHistory = [...(session.conversationHistory || []), userMsg, assistantMsg].slice(-20);
        const updatedAnalyses = [...(session.visualAnalyses || []), { timestamp: new Date().toISOString(), analysis: visualAnalysis }].slice(-5);

        await updateSession(sessionId, { conversationHistory: updatedHistory, visualAnalyses: updatedAnalyses, itemDescription: visualAnalysis.summary }).catch(() => { });
        await updateUserStats(req.user.id, { analysisCount: 1 }).catch(() => { });

        res.json({ sessionId, visualAnalysis, decisions, conversationHistory: [userMsg, assistantMsg] });
    } catch (err) {
        next(err);
    }
}

// POST /api/analysis/repair-step
export async function getRepairStep(req, res, next) {
    try {
        const { sessionId, optionData, stepIndex } = req.body;
        if (!optionData) return res.status(400).json({ error: 'Option data required' });

        let itemDescription = `a ${optionData.action?.toLowerCase() || 'household'} item`;
        if (sessionId) {
            const session = await getSession(sessionId).catch(() => null);
            if (session?.itemDescription) itemDescription = session.itemDescription;
        }

        const step = optionData.repairSteps?.[stepIndex] || `Step ${(stepIndex || 0) + 1}`;
        const detail = await generateRepairStepDetail(optionData, step, itemDescription);

        await updateSession(sessionId, { currentRepairStep: stepIndex, selectedOption: optionData.action }).catch(() => { });

        res.json({ step, detail, stepIndex: stepIndex || 0, totalSteps: optionData.repairSteps?.length || 1 });
    } catch (err) {
        next(err);
    }
}

// POST /api/analysis/continue
export async function continueConversation(req, res, next) {
    try {
        const { sessionId, userMessage, imageBase64, mimeType } = req.body;
        if (!sessionId || !userMessage) return res.status(400).json({ error: 'sessionId and userMessage required' });

        const session = await getSession(sessionId).catch(() => null);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        let visualAnalysis = session.visualAnalyses?.slice(-1)[0]?.analysis || {};
        if (imageBase64) {
            visualAnalysis = await analyzeImageWithGemini(imageBase64, mimeType || 'image/jpeg');
            await updateSession(sessionId, { visualAnalyses: [...(session.visualAnalyses || []), { timestamp: new Date().toISOString(), analysis: visualAnalysis }].slice(-5) }).catch(() => { });
        }

        const decisions = await generateDecisionsWithGemini(visualAnalysis, session.conversationHistory || [], userMessage);
        const userMsg = { role: 'user', content: userMessage, timestamp: new Date().toISOString() };
        const assistantMsg = { role: 'assistant', content: decisions.recommendationReason || 'Here are my updated recommendations.', timestamp: new Date().toISOString() };
        await updateSession(sessionId, { conversationHistory: [...(session.conversationHistory || []), userMsg, assistantMsg].slice(-20) }).catch(() => { });

        res.json({ sessionId, visualAnalysis, decisions, conversationHistory: [userMsg, assistantMsg] });
    } catch (err) {
        next(err);
    }
}

// POST /api/analysis/complete  — record completed action
export async function completeAction(req, res, next) {
    try {
        const { co2Avoided = 0, itemsSaved = 1 } = req.body;
        await updateUserStats(req.user.id, { itemsSaved, co2Saved: co2Avoided }).catch(() => { });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}
