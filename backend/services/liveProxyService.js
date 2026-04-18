import WebSocket from 'ws';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.0-flash-live-001';
const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_INSTRUCTION = `You are ReLife AI, a friendly and knowledgeable sustainability repair expert.
You help users identify broken household items through their camera and guide them through repairs.

Your personality:
- Warm, encouraging, and patient
- You prioritize sustainability: repair over replace
- You give clear, step-by-step spoken instructions
- You can see what the user shows you via their camera
- Keep responses concise and conversational (2-3 sentences for quick observations, longer for repair instructions)

When you see an item:
1. Identify what it is and its condition
2. Suggest the most sustainable course of action (repair, repurpose, donate, recycle)
3. If repair is possible, offer to guide them step-by-step
4. Mention approximate cost savings vs buying new and environmental impact

Always be encouraging about repair attempts, even for beginners.`;

/**
 * Creates a bidirectional proxy between a client WebSocket and the Gemini Live API.
 * 
 * @param {WebSocket} clientWs - The WebSocket connection from the browser client
 * @param {object} user - The authenticated user object { id, email, name }
 */
export function createLiveSession(clientWs, user) {
  console.log(`[LiveProxy] Creating session for user ${user.email}`);

  let geminiWs = null;
  let isSetupComplete = false;
  let messageQueue = [];

  // ── Connect to Gemini Live API ────────────────────────────────────────────
  try {
    geminiWs = new WebSocket(GEMINI_WS_URL);
  } catch (err) {
    console.error('[LiveProxy] Failed to create Gemini WS:', err.message);
    clientWs.send(JSON.stringify({ error: 'Failed to connect to Gemini Live API' }));
    clientWs.close();
    return;
  }

  geminiWs.on('open', () => {
    console.log('[LiveProxy] Connected to Gemini Live API');

    // Send the setup/config message
    const setupMessage = {
      setup: {
        model: `models/${LIVE_MODEL}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede'
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };

    geminiWs.send(JSON.stringify(setupMessage));
    console.log('[LiveProxy] Setup message sent');
  });

  geminiWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Check for setup complete
      if (message.setupComplete) {
        isSetupComplete = true;
        console.log('[LiveProxy] Setup complete, flushing queue:', messageQueue.length);

        // Forward to client
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ setupComplete: true }));
        }

        // Flush any queued messages
        for (const queuedMsg of messageQueue) {
          geminiWs.send(queuedMsg);
        }
        messageQueue = [];
        return;
      }

      // Forward all other messages to the client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    } catch (err) {
      console.error('[LiveProxy] Error parsing Gemini message:', err.message);
    }
  });

  geminiWs.on('error', (err) => {
    console.error('[LiveProxy] Gemini WS error:', err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: `Gemini connection error: ${err.message}` }));
    }
  });

  geminiWs.on('close', (code, reason) => {
    console.log(`[LiveProxy] Gemini WS closed: ${code} ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: 'Gemini session ended', code }));
      clientWs.close();
    }
  });

  // ── Handle messages from the client ────────────────────────────────────────
  clientWs.on('message', (data) => {
    try {
      const message = data.toString();

      if (!isSetupComplete) {
        // Queue messages until setup is complete
        messageQueue.push(message);
        return;
      }

      // Forward to Gemini
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(message);
      }
    } catch (err) {
      console.error('[LiveProxy] Error forwarding client message:', err.message);
    }
  });

  // ── Cleanup on client disconnect ───────────────────────────────────────────
  clientWs.on('close', () => {
    console.log(`[LiveProxy] Client disconnected (user: ${user.email})`);
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close();
    }
    geminiWs = null;
    messageQueue = [];
  });

  clientWs.on('error', (err) => {
    console.error('[LiveProxy] Client WS error:', err.message);
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close();
    }
  });
}
