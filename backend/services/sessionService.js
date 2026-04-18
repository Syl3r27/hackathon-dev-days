import { v4 as uuidv4 } from 'uuid';
import { Session } from '../models/Session.js';

export async function createSession(userId) {
  const sessionId = uuidv4();
  
  const session = await Session.create({
    sessionId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    conversationHistory: [],
    visualAnalyses: [],
    currentRepairStep: 0,
    selectedOption: null,
    itemDescription: null,
    status: 'active'
  });
  
  const { _id, __v, ...safeSession } = session.toObject();
  return safeSession;
}

export async function getSession(sessionId) {
  const session = await Session.findOne({ sessionId }).lean();
  if (!session) return null;
  const { _id, __v, ...safeSession } = session;
  return safeSession;
}

export async function updateSession(sessionId, updates) {
  await Session.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        ...updates,
        updatedAt: new Date()
      }
    }
  );
}

export async function deleteSession(sessionId) {
  await Session.deleteOne({ sessionId });
}
