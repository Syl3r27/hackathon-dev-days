import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  conversationHistory: { type: Array, default: [] },
  visualAnalyses: { type: Array, default: [] },
  currentRepairStep: { type: Number, default: 0 },
  selectedOption: { type: mongoose.Schema.Types.Mixed, default: null },
  itemDescription: { type: String, default: null },
  status: { type: String, default: 'active' }
});

export const Session = mongoose.model('Session', sessionSchema);
