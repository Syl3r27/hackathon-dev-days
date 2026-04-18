'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useAppStore } from './store';
import { useCamera } from './useCamera';
import { useElevenLabs } from './useElevenLabs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('relife_access_token');
}

interface RealtimeMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function useRealtimeInteraction() {
  const { setError, sessionId, setSessionId } = useAppStore();
  const { videoRef, startCamera, stopCamera, captureFrame, isActive } = useCamera();
  const { speak, stop: stopSpeech } = useElevenLabs();
  
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureCounter, setCaptureCounter] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const loopRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const stateRef = useRef({ isRunning: false, sessionId: '', messages: [] as RealtimeMessage[] });
  const captureRef = useRef<(() => Promise<void>) | null>(null);

  // Update refs with current state for use in callbacks
  useEffect(() => {
    stateRef.current.isRunning = isRunning;
    stateRef.current.sessionId = sessionId || '';
    stateRef.current.messages = messages;
  }, [isRunning, sessionId, messages]);

  // Initialize speech recognition
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn('Speech Recognition not available');
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log('[Speech] Listening...');
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('[Speech] Stopped listening');
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        console.log('[Speech] Detected:', transcript);
        processUserInput(transcript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('[Speech Error]', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  const processUserInput = useCallback(async (userMessage: string) => {
    if (!stateRef.current.sessionId) {
      setError('Session not initialized. Please wait for first analysis.');
      return;
    }

    console.log('[Processing] User input:', userMessage);
    setIsListening(false);
    setIsProcessing(true);

    // Add user message to messages
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);

    try {
      const token = getToken();
      console.log('[API] Calling /api/analysis/continue');

      const res = await fetch(`${API_BASE}/api/analysis/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sessionId: stateRef.current.sessionId,
          userMessage,
          conversationHistory: stateRef.current.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `API error ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage = data.response || data.recommendationReason || data.message || 'Processing...';

      console.log('[Response]', assistantMessage);

      // Add assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage, timestamp: Date.now() }]);
      setCurrentResponse(assistantMessage);

      // Speak response
      await speak(assistantMessage);

      // Resume capturing after short delay
      setIsProcessing(false);
      if (stateRef.current.isRunning) {
        console.log('[Resume] Restarting listening after user input');
        setTimeout(() => startListening(), 1000);
      }
    } catch (err: any) {
      console.error('[Error]', err.message);
      setError(err.message || 'Failed to process input');
      setIsProcessing(false);
      // Try to resume anyway
      if (stateRef.current.isRunning) {
        setTimeout(() => startListening(), 1000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, setError]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && stateRef.current.isRunning && !isListening) {
      try {
        recognitionRef.current.start();
        console.log('[Speech] Starting to listen');

        // Auto-capture if no speech for 6 seconds
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          console.log('[Timeout] No speech detected, capturing frame');
          if (recognitionRef.current) recognitionRef.current.abort();
          if (captureRef.current) captureRef.current();
        }, 6000);
      } catch (err) {
        console.warn('[Speech] Already listening');
      }
    }
  }, [isListening]);

  const captureAndAnalyze = useCallback(async () => {
    if (!stateRef.current.isRunning || isProcessing || !isActive()) return;

    const frame = captureFrame();
    if (!frame) return;

    setIsProcessing(true);
    setCaptureCounter(c => c + 1);

    try {
      const token = getToken();

      // First capture - create session
      if (!stateRef.current.sessionId) {
        console.log('[Analyze] First capture - creating session');
        const res = await fetch(`${API_BASE}/api/analysis/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            imageBase64: frame,
            mimeType: 'image/jpeg',
            userMessage: 'Analyze this item.'
          })
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `API error ${res.status}`);
        }

        const data = await res.json();
        const newSessionId = data.sessionId;
        const assistantMessage = data.decisions?.recommendationReason || 'Analyzing...';

        console.log('[Session Created]', newSessionId);
        setSessionId(newSessionId);
        stateRef.current.sessionId = newSessionId;

        setCurrentResponse(assistantMessage);
        setMessages([{ role: 'assistant', content: assistantMessage, timestamp: Date.now() }]);

        await speak(assistantMessage);
        setIsProcessing(false);

        // Start listening after first analysis
        startListening();
        return;
      }

      // Subsequent captures - use continue
      console.log('[Analyze] Continuous frame capture');
      const res = await fetch(`${API_BASE}/api/analysis/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sessionId: stateRef.current.sessionId,
          imageBase64: frame,
          userMessage: 'Analyze current frame.',
          conversationHistory: stateRef.current.messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `API error ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage = data.response || data.message || 'Analyzing...';

      console.log('[Frame Response]', assistantMessage);
      setCurrentResponse(assistantMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage, timestamp: Date.now() }]);

      await speak(assistantMessage);
      setIsProcessing(false);

      // Start listening after analysis
      startListening();
    } catch (err: any) {
      console.error('[Capture Error]', err.message);
      setError(err.message || 'Frame analysis failed');
      setIsProcessing(false);
    }
  }, [isProcessing, isActive, captureFrame, speak, setError, startListening]);

  // Store captureAndAnalyze in ref so it can be called from timeout
  useEffect(() => {
    captureRef.current = captureAndAnalyze;
  }, [captureAndAnalyze]);



  const start = useCallback(async () => {
    try {
      console.log('[Start] Initializing real-time interaction');
      await startCamera();
      setIsRunning(true);
      setMessages([]);
      setCurrentResponse('');
      setCaptureCounter(0);

      // Trigger first capture immediately
      console.log('[Start] Triggering first capture');
      setTimeout(() => {
        captureAndAnalyze();
      }, 500);
    } catch (err: any) {
      console.error('[Start Error]', err.message);
      setError(err.message || 'Failed to start camera');
      setIsRunning(false);
    }
  }, [startCamera, captureAndAnalyze, setError]);

  const stop = useCallback(() => {
    console.log('[Stop] Shutting down real-time interaction');
    setIsRunning(false);
    if (loopRef.current) clearInterval(loopRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    stopSpeech();
    stopCamera();
  }, [stopCamera, stopSpeech]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    videoRef,
    isRunning,
    messages,
    currentResponse,
    isProcessing,
    captureCounter,
    isListening,
    start,
    stop,
    handleUserInput: processUserInput
  };
}
