import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { authRouter } from './routes/auth.js';
import { analysisRouter } from './routes/analysis.js';
import { sessionRouter } from './routes/session.js';
import { voiceRouter } from './routes/voice.js';
import { errorHandler } from './middleware/errorHandler.js';
import connectDB from './lib/db.js';
import { verifyAccessToken } from './services/tokenService.js';
import { createLiveSession } from './services/liveProxyService.js';

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

// ── HTTP + WebSocket Server ──────────────────────────────────────────────────
const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    // Only handle /ws/live path
    if (url.pathname !== '/ws/live') {
      socket.destroy();
      return;
    }

    // Authenticate via query param token
    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let user;
    try {
      const decoded = verifyAccessToken(token);
      user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    } catch (err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Complete the upgrade
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.user = user;
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    console.error('[WS Upgrade] Error:', err.message);
    socket.destroy();
  }
});

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  console.log(`[WS] New live connection from ${ws.user.email}`);
  createLiveSession(ws, ws.user);
});

server.listen(PORT, () => console.log(`[ReLife AI] Backend running on port ${PORT} (HTTP + WebSocket)`));
export default app;
