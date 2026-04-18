import { synthesize, synthesizeStream, listVoices, isConfigured } from '../services/elevenLabsService.js';
import { catchAsync } from '../utils/catchAsync.js';

export const synthesizeSpeech = catchAsync(async (req, res, next) => {
  try {
    const { text, voiceId, stream } = req.body;

    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
    if (text.length > 5000) return res.status(400).json({ error: 'text too long (max 5000 chars)' });

    if (stream) {
      await synthesizeStream(text, res, voiceId);
    } else {
      const audio = await synthesize(text, voiceId);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audio.length);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(audio);
    }
  } catch (err) {
    if (err.message?.includes('not configured')) {
      return res.status(503).json({ error: 'ElevenLabs not configured. Set ELEVENLABS_API_KEY.', code: 'TTS_UNAVAILABLE' });
    }
    throw err;
  }
});

export const voiceStatus = catchAsync(async (req, res) => {
  res.json({
    available: isConfigured(),
    model: 'eleven_turbo_v2_5',
    defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
  });
});

export const voices = catchAsync(async (req, res, next) => {
  const list = await listVoices();
  res.json({ voices: list.map(v => ({ id: v.voice_id, name: v.name, category: v.category, previewUrl: v.preview_url })) });
});
