import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { analysisRouter } from './routes/analysis.js';
import { sessionRouter } from './routes/session.js';
import { voiceRouter } from './routes/voice.js';
import { errorHandler } from './middleware/errorHandler.js';
import connectDB from './lib/db.js';

const app = express();

// Initialize Database connection
connectDB();

const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many auth attempts. Try again in 15 minutes.' } });

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/session', sessionRouter);
app.use('/api/voice', voiceRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use(errorHandler);

app.listen(PORT, () => console.log(`[ReLife AI] Backend running on port ${PORT}`));
export default app;
