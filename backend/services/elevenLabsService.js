import { ElevenLabsClient } from 'elevenlabs';

const MODEL = 'eleven_flash_v2_5';
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const VOICE_SETTINGS = { stability: 0.50, similarity_boost: 0.75, style: 0.30, use_speaker_boost: true };

let client = null;
const getClient = () => {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not configured');
  return client ??= new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
};

const createAudioStream = (text, voiceId) => 
  getClient().textToSpeech.convert(voiceId || DEFAULT_VOICE_ID, {
    text: text.slice(0, 5000),
    model_id: MODEL,
    voice_settings: VOICE_SETTINGS
  });

export async function synthesize(text, voiceId) {
  if (!text?.trim()) throw new Error('Text is required');
  
  try {
    const stream = await createAudioStream(text, voiceId);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch (error) {
    if ([401, 402, 429].includes(error.statusCode)) {
      console.warn(`[ElevenLabs] Quota or Auth error (${error.statusCode}). Falling back to browser TTS.`);
      throw Object.assign(new Error('ElevenLabs Quota Exceeded'), { status: 503 });
    }
    console.error('ElevenLabs Synthesize Error:', error.message);
    throw error;
  }
}

export async function synthesizeStream(text, res, voiceId) {
  if (!text?.trim()) throw new Error('Text is required');

  try {
    const stream = await createAudioStream(text, voiceId);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    stream.pipe(res);
    return new Promise((resolve, reject) => stream.on('end', resolve).on('error', reject));
  } catch (error) {
    const isAuthError = [401, 402, 429].includes(error.statusCode);
    if (isAuthError) {
      console.warn(`[ElevenLabs] Quota or Auth error (${error.statusCode}). Falling back to browser TTS.`);
    } else {
      console.error('ElevenLabs Stream Error:', error.message);
    }
    
    if (!res.headersSent) {
      res.status(503).json({ error: isAuthError ? 'TTS Service Unavailable (Quota/Rate Limit)' : 'TTS Service Unavailable' });
    }
  }
}

export async function listVoices() {
  try {
    return (await getClient().voices.getAll()).voices || [];
  } catch (error) {
    console.error('ElevenLabs ListVoices Error:', error?.body || error.message);
    return [];
  }
}

export const isConfigured = () => !!process.env.ELEVENLABS_API_KEY;
