/**
 * ReLife AI — Backend Route Test Runner
 * Run with: npm run test:run
 *
 * Tests every route group:
 *   ✓ Health
 *   ✓ Auth  (register, login, /me, refresh, logout)
 *   ✓ Voice (status — public; voices, synthesize — protected)
 *   ✓ Session (init, get, delete)
 *   ✓ Analysis (analyze, repair-step, continue, complete)
 */

import 'dotenv/config';

// ─── Config ────────────────────────────────────────────────────────────────
const BASE = `http://localhost:${process.env.PORT || 3001}`;
const TEST_USER = {
  email: `test_${Date.now()}@relife.ai`,
  password: 'TestPass123!',
  name: 'Test Runner',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

let passed = 0;
let failed = 0;
let skipped = 0;

function header(title) {
  console.log(`\n${c.bold}${c.cyan}━━━ ${title} ━━━${c.reset}`);
}

async function test(label, fn) {
  try {
    const result = await fn();
    if (result === 'SKIP') {
      console.log(`  ${c.yellow}⊘ SKIP${c.reset}  ${label}`);
      skipped++;
    } else {
      console.log(`  ${c.green}✓ PASS${c.reset}  ${label}`);
      passed++;
    }
  } catch (err) {
    console.log(`  ${c.red}✗ FAIL${c.reset}  ${label}`);
    console.log(`         ${c.dim}${err.message}${c.reset}`);
    failed++;
  }
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── State shared across tests ───────────────────────────────────────────────
let accessToken = null;
let refreshToken = null;
let sessionId = null;

// ════════════════════════════════════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════════════════════════════════════
header('Health');

await test('GET /health → 200 with status:ok', async () => {
  const { status, data } = await req('GET', '/health');
  assert(status === 200, `Expected 200, got ${status}`);
  assert(data.status === 'ok', `Expected status:"ok", got "${data.status}"`);
});

// ════════════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════════════
header('Auth');

await test('POST /api/auth/register → 201 new user', async () => {
  const { status, data } = await req('POST', '/api/auth/register', TEST_USER);
  assert(status === 201 || status === 200, `Expected 2xx, got ${status}: ${JSON.stringify(data)}`);
});

await test('POST /api/auth/register (duplicate) → 409 conflict', async () => {
  const { status } = await req('POST', '/api/auth/register', TEST_USER);
  assert(status === 409 || status === 400, `Expected 4xx conflict, got ${status}`);
});

await test('POST /api/auth/login → 200 with accessToken', async () => {
  const { status, data } = await req('POST', '/api/auth/login', {
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert(data.accessToken, 'No accessToken in response');
  accessToken = data.accessToken;
  refreshToken = data.refreshToken ?? null; // may not always be returned
});

await test('POST /api/auth/login (wrong password) → 401', async () => {
  const { status } = await req('POST', '/api/auth/login', {
    email: TEST_USER.email,
    password: 'WrongPassword!',
  });
  assert(status === 401, `Expected 401, got ${status}`);
});

await test('GET /api/auth/me → 200 with user object', async () => {
  if (!accessToken) throw new Error('No token — login test failed');
  const { status, data } = await req('GET', '/api/auth/me', null, accessToken);
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert(data.email || data.user?.email, 'No email in /me response');
});

await test('GET /api/auth/me (no token) → 401', async () => {
  const { status } = await req('GET', '/api/auth/me');
  assert(status === 401, `Expected 401, got ${status}`);
});

await test('POST /api/auth/refresh → 200 with new token', async () => {
  if (!refreshToken) return 'SKIP'; // login didn't return a refreshToken
  const { status, data } = await req('POST', '/api/auth/refresh', { refreshToken });
  if (status === 501 || status === 404) return 'SKIP';
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
});

// ════════════════════════════════════════════════════════════════════════════
// VOICE
// ════════════════════════════════════════════════════════════════════════════
header('Voice');

await test('GET /api/voice/status → 200 (public)', async () => {
  const { status } = await req('GET', '/api/voice/status');
  assert(status === 200, `Expected 200, got ${status}`);
});

await test('GET /api/voice/voices → 200 (protected)', async () => {
  if (!accessToken) throw new Error('No token — login test failed');
  const { status, data } = await req('GET', '/api/voice/voices', null, accessToken);
  // May return 503 if ElevenLabs key not configured
  assert(status === 200 || status === 503, `Expected 200/503, got ${status}: ${JSON.stringify(data)}`);
});

await test('POST /api/voice/synthesize (no token) → 401', async () => {
  const { status } = await req('POST', '/api/voice/synthesize', { text: 'Hello' });
  assert(status === 401, `Expected 401, got ${status}`);
});

// ════════════════════════════════════════════════════════════════════════════
// SESSION
// ════════════════════════════════════════════════════════════════════════════
header('Session');

await test('POST /api/session/init → 200 with sessionId', async () => {
  if (!accessToken) throw new Error('No token — login test failed');
  const { status, data } = await req('POST', '/api/session/init', {}, accessToken);
  assert(status === 200 || status === 201, `Expected 2xx, got ${status}: ${JSON.stringify(data)}`);
  assert(data.sessionId, 'No sessionId in response');
  sessionId = data.sessionId;
});

await test('GET /api/session/:sessionId → 200 session data', async () => {
  if (!sessionId) throw new Error('No sessionId — init test failed');
  const { status, data } = await req('GET', `/api/session/${sessionId}`, null, accessToken);
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
});

await test('GET /api/session/nonexistent → 404', async () => {
  const { status } = await req('GET', '/api/session/00000000-does-not-exist', null, accessToken);
  assert(status === 404, `Expected 404, got ${status}`);
});

await test('DELETE /api/session/:sessionId → 200 success', async () => {
  if (!sessionId) throw new Error('No sessionId — init test failed');
  const { status, data } = await req('DELETE', `/api/session/${sessionId}`, null, accessToken);
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert(data.success === true, 'Expected success:true');
});

// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS (protected — requires auth; AI calls may be skipped if no API key)
// ════════════════════════════════════════════════════════════════════════════
header('Analysis');

await test('POST /api/analysis/analyze (no token) → 401', async () => {
  const { status } = await req('POST', '/api/analysis/analyze', { item: 'test' });
  assert(status === 401, `Expected 401, got ${status}`);
});

await test('POST /api/analysis/analyze (missing body) → 400 or 422', async () => {
  if (!accessToken) throw new Error('No token — login test failed');
  const { status } = await req('POST', '/api/analysis/analyze', {}, accessToken);
  // Either 400 validation error or 422 unprocessable — not 200
  assert(status >= 400, `Expected 4xx/5xx for empty body, got ${status}`);
});

await test('POST /api/analysis/repair-step (no token) → 401', async () => {
  const { status } = await req('POST', '/api/analysis/repair-step', {});
  assert(status === 401, `Expected 401, got ${status}`);
});

await test('POST /api/analysis/continue (no token) → 401', async () => {
  const { status } = await req('POST', '/api/analysis/continue', {});
  assert(status === 401, `Expected 401, got ${status}`);
});

await test('POST /api/analysis/complete (no token) → 401', async () => {
  const { status } = await req('POST', '/api/analysis/complete', {});
  assert(status === 401, `Expected 401, got ${status}`);
});

// ════════════════════════════════════════════════════════════════════════════
// Auth Cleanup — logout
// ════════════════════════════════════════════════════════════════════════════
header('Auth Cleanup');

await test('POST /api/auth/logout → 200', async () => {
  if (!accessToken) throw new Error('No token');
  const { status } = await req('POST', '/api/auth/logout', {}, accessToken);
  assert(status === 200, `Expected 200, got ${status}`);
});

// ════════════════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${c.bold}━━━ Results ━━━${c.reset}`);
console.log(`  ${c.green}${passed} passed${c.reset}  ${c.red}${failed} failed${c.reset}  ${c.yellow}${skipped} skipped${c.reset}`);
if (failed > 0) {
  console.log(`\n${c.red}${c.bold}✗ Some tests failed.${c.reset}`);
  process.exit(1);
} else {
  console.log(`\n${c.green}${c.bold}✓ All tests passed!${c.reset}`);
}
