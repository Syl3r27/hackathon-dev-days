# 🌿 ReLife AI v3 — Repair. Reuse. Rethink.

> **Gemini Vision** + **ElevenLabs TTS** + **JWT Auth** + DynamoDB session persistence.

---

## 🏗️ Architecture

```
ReLife AI v3
├── backend/
│   ├── server.js
│   ├── services/
│   │   ├── geminiService.js        ← Vision + reasoning (gemini-2.0-flash)
│   │   ├── elevenLabsService.js    ← TTS: buffered + streaming (eleven_turbo_v2_5)
│   │   ├── userService.js          ← Auth user CRUD (DynamoDB or in-memory)
│   │   ├── sessionService.js       ← Session persistence
│   │   └── tokenService.js         ← JWT access + refresh tokens
│   ├── middleware/
│   │   ├── authMiddleware.js       ← requireAuth / optionalAuth guards
│   │   └── errorHandler.js
│   ├── controllers/
│   │   ├── authController.js       ← register, login, refresh, me, logout
│   │   ├── analysisController.js   ← analyze, repair-step, continue, complete
│   │   └── voiceController.js      ← synthesize, stream, voices, status
│   └── routes/
│       ├── auth.js    → /api/auth/*
│       ├── analysis.js → /api/analysis/*  (JWT protected)
│       ├── session.js  → /api/session/*   (JWT protected)
│       └── voice.js    → /api/voice/*     (synthesize JWT protected)
│
└── frontend/
    └── app/
        ├── components/
        │   ├── AppInitializer.tsx   ← Auto-login from localStorage tokens
        │   ├── AuthScreen.tsx       ← Login + Register with validation
        │   ├── LandingScreen.tsx    ← Hero + per-user stats + logout
        │   ├── ScanningScreen.tsx   ← Camera + voice trigger + upload
        │   ├── DecisionsScreen.tsx  ← 5-option dashboard + ElevenLabs intro
        │   ├── RepairScreen.tsx     ← Step-by-step + ElevenLabs per-step + waveform
        │   └── ImpactScreen.tsx     ← Impact metrics + ElevenLabs celebration
        └── lib/
            ├── useElevenLabs.ts     ← ElevenLabs hook with Web Audio + browser fallback
            ├── authStore.ts         ← Zustand auth + localStorage sync
            ├── store.ts             ← App phase/analysis state + isSpeaking
            ├── api.ts               ← Typed client with JWT refresh
            └── useCamera.ts         ← Camera stream + frame capture
```

---

## 🤖 Full AI Pipeline

```
📷 Camera Frame
      ↓
[1] Gemini 2.0 Flash  ← Visual analysis
    • Object type, brand, components
    • Condition, damage, repairability
      ↓
[2] Gemini 2.0 Flash  ← Decision engine
    • 5 sustainability options
    • Cost, time, difficulty, CO₂ impact
    • Step-by-step repair guide
      ↓
[3] Gemini 2.0 Flash  ← Per-step detail
    • Voice-friendly instructions
    • Warnings + pro tips
      ↓
[4] ElevenLabs TTS    ← Voice output
    • eleven_turbo_v2_5 (low latency)
    • Buffered or streaming
    • Auto-fallback to Web Speech API
```

---

## 🔊 ElevenLabs Integration

### Where voice is used
| Screen | What is spoken |
|---|---|
| **Decisions** | Recommendation + reasoning on load |
| **Repair** | Every step read aloud automatically |
| **Impact** | Personalised celebration message |
| **All** | "Replay" button to re-hear any content |

### How it works (frontend)
```
useElevenLabs hook
  → checks /api/voice/status on mount
  → if available: POST /api/voice/synthesize → ArrayBuffer → Web Audio API
  → if 503 / no key: falls back to window.speechSynthesis
  → isSpeaking state drives live waveform in UI
```

### Backend endpoints
| Method | Path | Description |
|---|---|---|
| GET | /api/voice/status | Is ElevenLabs configured? (public) |
| POST | /api/voice/synthesize | Get mp3 buffer or stream (auth required) |
| GET | /api/voice/voices | List available voices (auth required) |

### Voice selection
Set `ELEVENLABS_VOICE_ID` in `.env`. Default is **Rachel** (`21m00Tcm4TlvDq8ikWAM`) — warm, clear, natural.

Popular alternatives:
| Name | ID |
|---|---|
| Rachel (default) | `21m00Tcm4TlvDq8ikWAM` |
| Adam | `pNInz6obpgDQGcFmaJgB` |
| Bella | `EXAVITQu4vr4xnSDxMaL` |
| Josh | `TxGEqnHWrfWFTfGW9XjX` |
| Elli | `MF3mGyEYCl7XYWbV9V6O` |

Run `GET /api/voice/voices` to see all voices on your account.

---

## 🔐 Authentication

```
Register/Login
    ↓
Access Token (JWT, 15 min) + Refresh Token (JWT, 7 days)
    ↓
Stored in localStorage
    ↓
All /api/analysis/* and /api/voice/synthesize require Bearer token
    ↓
Auto-refresh on 401 TOKEN_EXPIRED
    ↓
On refresh failure → redirect to login
```

---

## 🚀 Quick Start

### 1. Install

```bash
cd backend  && npm install && cp .env.example .env
cd frontend && npm install && cp .env.local.example .env.local
```

### 2. Configure `backend/.env`

```env
# Required
GEMINI_API_KEY=your_key            # aistudio.google.com
ELEVENLABS_API_KEY=your_key        # elevenlabs.io
JWT_SECRET=long-random-string
JWT_REFRESH_SECRET=another-long-string

# Optional voice customisation
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # Rachel (default)

# Optional AWS (in-memory fallback used if omitted)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### 3. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open **http://localhost:3000** → Register → Scan → hear ElevenLabs guide you through the repair.

---

## 📱 Voice Commands (Web Speech API input)

| Say | Action |
|---|---|
| "analyze" / "scan" | Trigger camera capture |
| "done" / "next" / "continue" | Advance repair step |
| "repeat" / "again" | Re-read current step via ElevenLabs |
| "help" / "tips" | Read pro tips aloud |

---

## 🚢 Production

```bash
# Backend (Railway / Render)
NODE_ENV=production npm start

# Frontend (Vercel)
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app vercel --prod
```
