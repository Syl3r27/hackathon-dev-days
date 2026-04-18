import { analyzeImageWithGemini, generateDecisionsWithGemini, generateRepairStepDetail } from '../services/geminiService.js';
import { createSession, getSession, updateSession } from '../services/sessionService.js';
import { updateUserStats } from '../services/userService.js';
import { v4 as uuidv4 } from 'uuid';
import { catchAsync } from '../utils/catchAsync.js';

export const analyzeItem = catchAsync(async (req, res, next) => {
  const { imageBase64, mimeType, userMessage, sessionId: existingSessionId } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Image data required' });

  const sessionId = existingSessionId || uuidv4();

  // ── Load session concurrently while we already know the sessionId ──────────
  const [visualAnalysis, session] = await Promise.all([
    analyzeImageWithGemini(imageBase64, mimeType || 'image/jpeg'),
    getSession(sessionId)
      .catch(() => null)
      .then(s => s ?? createSession(req.user.id)
        .catch(() => ({ sessionId, userId: req.user.id, conversationHistory: [], visualAnalyses: [] }))
      ),
  ]);

  // ── Decisions can only start after vision result is ready (correct) ────────
  const message = userMessage || `Please analyze my ${visualAnalysis.objectType || 'item'} and recommend the most sustainable course of action.`;
  const decisions = await generateDecisionsWithGemini(visualAnalysis, session.conversationHistory || [], message);

  // ── Build response payload ─────────────────────────────────────────────────
  const userMsg      = { role: 'user',      content: message,                                                                    timestamp: new Date().toISOString() };
  const assistantMsg = { role: 'assistant', content: `Recommendation: ${decisions.recommendation}. ${decisions.recommendationReason}`, timestamp: new Date().toISOString() };

  // ── Respond immediately — DB writes happen in background ──────────────────
  res.json({ sessionId, visualAnalysis, decisions, conversationHistory: [userMsg, assistantMsg] });

  const updatedHistory  = [...(session.conversationHistory  || []), userMsg, assistantMsg].slice(-20);
  const updatedAnalyses = [...(session.visualAnalyses || []), { timestamp: new Date().toISOString(), analysis: visualAnalysis }].slice(-5);
  Promise.all([
    updateSession(sessionId, { conversationHistory: updatedHistory, visualAnalyses: updatedAnalyses, itemDescription: visualAnalysis.summary }),
    updateUserStats(req.user.id, { analysisCount: 1 }),
  ]).catch(() => {});
});

export const getRepairStep = catchAsync(async (req, res, next) => {
  const { sessionId, optionData, stepIndex } = req.body;
  if (!optionData) return res.status(400).json({ error: 'Option data required' });

  let itemDescription = `a ${optionData.action?.toLowerCase() || 'household'} item`;
  if (sessionId) {
    const session = await getSession(sessionId).catch(() => null);
    if (session?.itemDescription) itemDescription = session.itemDescription;
  }

  const step = optionData.repairSteps?.[stepIndex] || `Step ${(stepIndex || 0) + 1}`;
  const detail = await generateRepairStepDetail(optionData, step, itemDescription);

  res.json({ step, detail, stepIndex: stepIndex || 0, totalSteps: optionData.repairSteps?.length || 1 });

  // fire-and-forget DB write
  updateSession(sessionId, { currentRepairStep: stepIndex, selectedOption: optionData.action }).catch(() => {});
});

export const continueConversation = catchAsync(async (req, res, next) => {
  const { sessionId, userMessage, imageBase64, mimeType } = req.body;
  if (!sessionId || !userMessage) return res.status(400).json({ error: 'sessionId and userMessage required' });

  const session = await getSession(sessionId).catch(() => null);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  let visualAnalysis = session.visualAnalyses?.slice(-1)[0]?.analysis || {};
  if (imageBase64) {
    // New image — must analyze before decisions
    visualAnalysis = await analyzeImageWithGemini(imageBase64, mimeType || 'image/jpeg');
  }

  const decisions = await generateDecisionsWithGemini(visualAnalysis, session.conversationHistory || [], userMessage);
  const userMsg      = { role: 'user',      content: userMessage,                                                          timestamp: new Date().toISOString() };
  const assistantMsg = { role: 'assistant', content: decisions.recommendationReason || 'Here are my updated recommendations.', timestamp: new Date().toISOString() };

  // Respond immediately
  res.json({ sessionId, visualAnalysis, decisions, conversationHistory: [userMsg, assistantMsg] });

  // Fire-and-forget DB writes
  const newHistory  = [...(session.conversationHistory || []), userMsg, assistantMsg].slice(-20);
  const newAnalyses = imageBase64
    ? [...(session.visualAnalyses || []), { timestamp: new Date().toISOString(), analysis: visualAnalysis }].slice(-5)
    : session.visualAnalyses;
  updateSession(sessionId, { conversationHistory: newHistory, ...(imageBase64 && { visualAnalyses: newAnalyses }) }).catch(() => {});
});

export const completeAction = catchAsync(async (req, res, next) => {
  const { co2Avoided = 0, itemsSaved = 1 } = req.body;
  res.json({ success: true }); // respond immediately
  updateUserStats(req.user.id, { itemsSaved, co2Saved: co2Avoided }).catch(() => {});
});

