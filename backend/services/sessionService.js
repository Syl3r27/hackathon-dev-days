import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db.js';

export async function createSession(userId) {
  const sessionId = uuidv4();
  const session = { 
    sessionId, 
    userId, 
    createdAt: new Date().toISOString(), 
    updatedAt: new Date().toISOString(), 
    conversationHistory: '[]', 
    visualAnalyses: '[]', 
    currentRepairStep: 0, 
    selectedOption: null, 
    itemDescription: null, 
    status: 'active' 
  };
  
  const stmt = db.prepare('INSERT INTO sessions (sessionId, userId, createdAt, updatedAt, conversationHistory, visualAnalyses, currentRepairStep, selectedOption, itemDescription, status) VALUES (@sessionId, @userId, @createdAt, @updatedAt, @conversationHistory, @visualAnalyses, @currentRepairStep, @selectedOption, @itemDescription, @status)');
  stmt.run(session);
  
  return {
    ...session,
    conversationHistory: [],
    visualAnalyses: []
  };
}

export async function getSession(sessionId) {
  const stmt = db.prepare('SELECT * FROM sessions WHERE sessionId = ?');
  const row = stmt.get(sessionId);
  if (!row) return null;
  return {
    ...row,
    conversationHistory: JSON.parse(row.conversationHistory || '[]'),
    visualAnalyses: JSON.parse(row.visualAnalyses || '[]'),
    selectedOption: row.selectedOption ? JSON.parse(row.selectedOption) : null
  };
}

export async function updateSession(sessionId, updates) {
  const session = await getSession(sessionId);
  if (!session) return;
  
  const updatedSession = Object.assign({}, session, updates, { updatedAt: new Date().toISOString() });
  
  const stmt = db.prepare(`
    UPDATE sessions 
    SET updatedAt = @updatedAt, 
        conversationHistory = @conversationHistory, 
        visualAnalyses = @visualAnalyses, 
        currentRepairStep = @currentRepairStep, 
        selectedOption = @selectedOption, 
        itemDescription = @itemDescription, 
        status = @status 
    WHERE sessionId = @sessionId
  `);
  
  stmt.run({
    sessionId: updatedSession.sessionId,
    updatedAt: updatedSession.updatedAt,
    conversationHistory: JSON.stringify(updatedSession.conversationHistory || []),
    visualAnalyses: JSON.stringify(updatedSession.visualAnalyses || []),
    currentRepairStep: updatedSession.currentRepairStep,
    selectedOption: updatedSession.selectedOption ? JSON.stringify(updatedSession.selectedOption) : null,
    itemDescription: updatedSession.itemDescription,
    status: updatedSession.status
  });
}

export async function deleteSession(sessionId) {
  const stmt = db.prepare('DELETE FROM sessions WHERE sessionId = ?');
  stmt.run(sessionId);
}
