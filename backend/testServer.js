/**
 * ReLife AI — HTML Test Dashboard Server
 * Serves the interactive test UI on port 4444 and proxies all
 * /api/* and /health requests to the backend at port 3001.
 *
 * Run with: npm test   (or node testServer.js)
 */

import http from 'http';
import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DASH_PORT = 4444;
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = process.env.PORT || 3001;

// ── Load the dashboard HTML ──────────────────────────────────────────────────
const dashboardHtml = readFileSync(join(__dirname, 'test-dashboard.html'), 'utf8');

// ── Proxy helper ─────────────────────────────────────────────────────────────
function proxyRequest(req, res) {
  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${BACKEND_HOST}:${BACKEND_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[Proxy Error]', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Backend unreachable: ${err.message}` }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

// ── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Serve dashboard
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(dashboardHtml);
    return;
  }

  // Proxy API + health routes to backend
  if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
    proxyRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(DASH_PORT, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log(`  │  ReLife AI · Test Dashboard                     │`);
  console.log(`  │  http://localhost:${DASH_PORT}                         │`);
  console.log(`  │  Proxying → http://localhost:${BACKEND_PORT}              │`);
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('');
});
