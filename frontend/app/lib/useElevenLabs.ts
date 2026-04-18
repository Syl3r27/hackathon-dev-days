'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useAppStore } from './store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('relife_access_token');
}

/** Browser TTS fallback */
function browserSpeak(text: string): Promise<void> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.93; u.pitch = 1.02; u.volume = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function useElevenLabs() {
  const { setIsSpeaking } = useAppStore();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const availableRef = useRef<boolean | null>(null); // null = unchecked

  // Check ElevenLabs availability once
  useEffect(() => {
    fetch(`${API_BASE}/api/voice/status`)
      .then(r => r.json())
      .then(d => { availableRef.current = !!d.available; })
      .catch(() => { availableRef.current = false; });
  }, []);

  const stop = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, [setIsSpeaking]);

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text?.trim()) return;
    stop();
    setIsSpeaking(true);

    // Try ElevenLabs first
    if (availableRef.current !== false) {
      try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/api/voice/synthesize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ text, stream: false })
        });

        if (res.ok) {
          availableRef.current = true;
          const arrayBuf = await res.arrayBuffer();

          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioContext();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') await ctx.resume();

          const decoded = await ctx.decodeAudioData(arrayBuf);
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(ctx.destination);
          sourceRef.current = source;

          await new Promise<void>(resolve => {
            source.onended = () => resolve();
            source.start();
          });
          setIsSpeaking(false);
          return;
        }

        // 503 = not configured, mark as unavailable
        if (res.status === 503) availableRef.current = false;
      } catch {
        availableRef.current = false;
      }
    }

    // Browser TTS fallback
    await browserSpeak(text);
    setIsSpeaking(false);
  }, [stop, setIsSpeaking]);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { speak, stop };
}
