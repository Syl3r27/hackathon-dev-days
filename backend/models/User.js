import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  analysisCount: { type: Number, default: 0 },
  itemsSaved: { type: Number, default: 0 },
  co2Saved: { type: Number, default: 0 }
});

export const User = mongoose.model('User', userSchema);
