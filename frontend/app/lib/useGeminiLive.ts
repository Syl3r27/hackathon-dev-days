'use client';
import { useRef, useCallback, useState, useEffect } from 'react';

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/^http/, 'ws');

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('relife_access_token');
}

export interface LiveMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * Converts an ArrayBuffer of Int16 PCM to a base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string of PCM audio to a Float32Array for Web Audio API playback.
 * Gemini outputs 24kHz, 16-bit, mono, little-endian PCM.
 */
function base64PcmToFloat32(base64: string): Float32Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [captureCounter, setCaptureCounter] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const micLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMicMutedRef = useRef(false);
  const isCameraOnRef = useRef(true);

  // Keep refs in sync with state
  useEffect(() => { isMicMutedRef.current = isMicMuted; }, [isMicMuted]);
  useEffect(() => { isCameraOnRef.current = isCameraOn; }, [isCameraOn]);

  // ── Audio Playback Queue ──────────────────────────────────────────────────
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const pcmData = audioQueueRef.current.shift()!;
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    const audioBuffer = ctx.createBuffer(1, pcmData.length, 24000);
    audioBuffer.getChannelData(0).set(pcmData);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;

    source.onended = () => {
      playNextAudio();
    };

    source.start(startTime);
  }, []);

  const enqueueAudio = useCallback((float32Data: Float32Array) => {
    audioQueueRef.current.push(float32Data);
    if (!isPlayingRef.current) {
      playNextAudio();
    }
  }, [playNextAudio]);

  // ── WebSocket Message Handler ─────────────────────────────────────────────
  const handleWsMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      // Setup complete
      if (msg.setupComplete) {
        setIsSetupComplete(true);
        setMessages(prev => [...prev, {
          role: 'system',
          content: 'Connected to Gemini Live — speak or show something to your camera!',
          timestamp: Date.now()
        }]);
        return;
      }

      // Error from proxy
      if (msg.error) {
        setError(msg.error);
        return;
      }

      // Server content (audio, transcriptions)
      if (msg.serverContent) {
        const sc = msg.serverContent;

        // Audio response from model
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data) {
              const float32 = base64PcmToFloat32(part.inlineData.data);
              enqueueAudio(float32);
            }
          }
        }

        // Input transcription (what the user said)
        if (sc.inputTranscription?.text) {
          const text = sc.inputTranscription.text.trim();
          if (text) {
            setMessages(prev => {
              // Merge consecutive user messages (partial transcriptions)
              const last = prev[prev.length - 1];
              if (last && last.role === 'user' && (Date.now() - last.timestamp) < 3000) {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: last.content + ' ' + text, timestamp: Date.now() };
                return updated;
              }
              return [...prev, { role: 'user', content: text, timestamp: Date.now() }];
            });
          }
        }

        // Output transcription (what the model said)
        if (sc.outputTranscription?.text) {
          const text = sc.outputTranscription.text.trim();
          if (text) {
            setMessages(prev => {
              // Merge consecutive assistant messages (streaming transcription)
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && (Date.now() - last.timestamp) < 5000) {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: last.content + text, timestamp: Date.now() };
                return updated;
              }
              return [...prev, { role: 'assistant', content: text, timestamp: Date.now() }];
            });
          }
        }

        // Turn complete — Gemini stopped speaking
        if (sc.turnComplete) {
          setIsListening(true);
        }
      }
    } catch (err) {
      console.error('[GeminiLive] Failed to parse WS message:', err);
    }
  }, [enqueueAudio]);

  // ── Camera Frame Capture ──────────────────────────────────────────────────
  const startFrameCapture = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    frameIntervalRef.current = setInterval(() => {
      if (!isCameraOnRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ws = wsRef.current;
      if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (!video.videoWidth) return;

      canvas.width = Math.min(video.videoWidth, 768);
      canvas.height = Math.min(video.videoHeight, 768);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      const base64 = dataUrl.split(',')[1];

      ws.send(JSON.stringify({
        realtimeInput: {
          video: {
            data: base64,
            mimeType: 'image/jpeg'
          }
        }
      }));

      setCaptureCounter(c => c + 1);
    }, 1000); // 1 FPS
  }, []);

  // ── Microphone Setup ──────────────────────────────────────────────────────
  const setupMicrophone = useCallback(async () => {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: { ideal: 16000 },
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    micStreamRef.current = micStream;

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

    // Load the PCM processor worklet
    await audioCtx.audioWorklet.addModule('/pcm-processor.js');

    const source = audioCtx.createMediaStreamSource(micStream);

    // Create an analyser for mic level visualization
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    source.connect(analyser);

    // Create the worklet node
    const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
    workletNodeRef.current = workletNode;

    workletNode.port.onmessage = (event) => {
      if (event.data.type === 'pcm' && !isMicMutedRef.current) {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          const base64 = arrayBufferToBase64(event.data.data);
          ws.send(JSON.stringify({
            realtimeInput: {
              audio: {
                data: base64,
                mimeType: 'audio/pcm;rate=16000'
              }
            }
          }));
        }
      }
    };

    source.connect(workletNode);
    workletNode.connect(audioCtx.destination); // Required for worklet to process

    // Start mic level monitoring
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    micLevelIntervalRef.current = setInterval(() => {
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        setMicLevel(avg / 255);
      }
    }, 100);

    setIsListening(true);
  }, []);

  // ── Camera Setup ──────────────────────────────────────────────────────────
  const setupCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 768 }, height: { ideal: 768 } }
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    try {
      setError(null);
      setMessages([]);
      setCaptureCounter(0);
      setIsSetupComplete(false);

      // Setup camera and microphone first
      await setupCamera();
      await setupMicrophone();

      // Initialize playback context
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      if (playbackCtxRef.current.state === 'suspended') {
        await playbackCtxRef.current.resume();
      }

      // Connect WebSocket
      const token = getToken();
      const wsUrl = `${WS_BASE}/ws/live?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[GeminiLive] WebSocket connected');
        setIsConnected(true);
        // Start sending camera frames
        startFrameCapture();
      };

      ws.onmessage = handleWsMessage;

      ws.onerror = (err) => {
        console.error('[GeminiLive] WebSocket error:', err);
        setError('Connection error — check that the backend is running');
      };

      ws.onclose = (event) => {
        console.log('[GeminiLive] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsSetupComplete(false);
        setIsListening(false);
      };
    } catch (err: any) {
      console.error('[GeminiLive] Connect error:', err);
      setError(err.message || 'Failed to connect');
    }
  }, [setupCamera, setupMicrophone, handleWsMessage, startFrameCapture]);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    // Stop frame capture
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    // Stop mic level monitor
    if (micLevelIntervalRef.current) {
      clearInterval(micLevelIntervalRef.current);
      micLevelIntervalRef.current = null;
    }

    // Stop audio worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Close audio contexts
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    // Stop mic
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;

    // Stop camera
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;

    // Close playback context
    if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsSetupComplete(false);
    setIsListening(false);
    setIsSpeaking(false);
    setMicLevel(0);
  }, []);

  // ── Send Text ─────────────────────────────────────────────────────────────
  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }]
        }],
        turnComplete: true
      }
    }));

    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
  }, []);

  // ── Toggle Mic ────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    setIsMicMuted(prev => !prev);
  }, []);

  // ── Toggle Camera ─────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    setIsCameraOn(prev => {
      const next = !prev;
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach(t => { t.enabled = next; });
      }
      return next;
    });
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return {
    videoRef,
    isConnected,
    isSetupComplete,
    messages,
    isSpeaking,
    isListening,
    isMicMuted,
    isCameraOn,
    captureCounter,
    micLevel,
    error,
    connect,
    disconnect,
    sendText,
    toggleMic,
    toggleCamera
  };
}
