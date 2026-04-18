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
  const { setError, sessionId } = useAppStore();
  const { videoRef, startCamera, stopCamera, captureFrame, isActive } = useCamera();
  const { speak, stop: stopSpeech } = useElevenLabs();
  
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureCounter, setCaptureCounter] = useState(0);
  
  const loopRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListeningRef.current = true;
      };

      recognition.onend = () => {
        isListeningRef.current = false;
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }
        if (transcript.trim()) {
          handleUserInput(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[Speech Recognition]', event.error);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleUserInput = useCallback(async (userMessage: string) => {
    if (isListeningRef.current && recognitionRef.current) {
      recognitionRef.current.abort();
      isListeningRef.current = false;
    }

    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);
    setIsProcessing(true);
    setCurrentResponse('');

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/analysis/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          userMessage,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage = data.response || data.message || 'I understand.';
      
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage, timestamp: Date.now() }]);
      setCurrentResponse(assistantMessage);

      // Speak the response
      await speak(assistantMessage);

      // Reset silence timer for next capture
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    } catch (err: any) {
      setError(err.message || 'Failed to process input');
      setIsProcessing(false);
    }
  }, [messages, sessionId, speak, setError]);

  const captureAndAnalyze = useCallback(async () => {
    if (!isRunning || isProcessing || !isActive()) return;

    const frame = captureFrame();
    if (!frame) return;

    setIsProcessing(true);
    setCaptureCounter(c => c + 1);

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/analysis/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          imageBase64: frame,
          userMessage: 'Analyze this frame and provide real-time feedback.',
          conversationHistory: messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage = data.response || data.message || 'Analyzing...';
      
      setCurrentResponse(assistantMessage);

      // Speak the response
      await speak(assistantMessage);

      // Add to messages
      setMessages(prev => [...prev, 
        { role: 'assistant', content: assistantMessage, timestamp: Date.now() }
      ]);

      setIsProcessing(false);

      // Start listening for user input
      if (recognitionRef.current && !isListeningRef.current) {
        recognitionRef.current.start();
        
        // Auto-restart listening if no speech detected after 8 seconds
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (isRunning && !isProcessing) {
            captureAndAnalyze(); // Capture next frame
          }
        }, 8000);
      }
    } catch (err: any) {
      setError(err.message || 'Frame analysis failed');
      setIsProcessing(false);
    }
  }, [isRunning, isProcessing, isActive, captureFrame, messages, sessionId, speak, setError]);

  const start = useCallback(async () => {
    try {
      await startCamera();
      setIsRunning(true);
      setMessages([]);
      setCurrentResponse('');

      // Start continuous capture loop (every 3 seconds)
      loopRef.current = setInterval(() => {
        captureAndAnalyze();
      }, 3000);

      // Initial capture
      setTimeout(captureAndAnalyze, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to start camera');
    }
  }, [startCamera, captureAndAnalyze, setError]);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (loopRef.current) clearInterval(loopRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.abort();
      isListeningRef.current = false;
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
    isListening: isListeningRef.current,
    start,
    stop,
    handleUserInput
  };
}
