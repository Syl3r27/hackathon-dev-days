'use client';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../lib/store';
import { useGeminiLive } from '../lib/useGeminiLive';
import {
  Radio, Wifi, WifiOff, Mic, MicOff, Camera, CameraOff,
  Send, ArrowLeft, Zap, MessageCircle, Volume2
} from 'lucide-react';

function AudioWaveform({ level, isActive, color = '#34d399' }: { level: number; isActive: boolean; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const barsRef = useRef<number[]>(Array(32).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bars = barsRef.current;
      const barCount = bars.length;
      const barWidth = w / barCount - 1;

      for (let i = 0; i < barCount; i++) {
        // Smooth random animation when active
        const target = isActive
          ? Math.max(0.08, level * (0.3 + Math.random() * 0.7))
          : 0.03;
        bars[i] += (target - bars[i]) * 0.15;

        const barHeight = bars[i] * h;
        const x = i * (barWidth + 1);
        const y = (h - barHeight) / 2;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.4 + bars[i] * 0.6;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [level, isActive, color]);

  return <canvas ref={canvasRef} width={192} height={40} style={{ width: '100%', height: 40 }} />;
}

function StatusDot({ active, color = 'emerald' }: { active: boolean; color?: string }) {
  return (
    <div className="relative flex items-center justify-center">
      <div className={`w-2.5 h-2.5 rounded-full ${active ? `bg-${color}-400` : 'bg-slate-600'}`} />
      {active && (
        <div className={`absolute w-2.5 h-2.5 rounded-full bg-${color}-400 animate-ping`} />
      )}
    </div>
  );
}

export default function RealtimeScreen() {
  const { setPhase } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [textInput, setTextInput] = useState('');

  const {
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
    error: liveError,
    connect,
    disconnect,
    sendText,
    toggleMic,
    toggleCamera
  } = useGeminiLive();

  // Entry animation
  useEffect(() => {
    import('gsap').then(({ gsap }) =>
      gsap.fromTo(containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' }
      )
    );
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendText = () => {
    if (textInput.trim() && isConnected && isSetupComplete) {
      sendText(textInput.trim());
      setTextInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleExit = () => {
    disconnect();
    setPhase('landing');
  };

  const connectionState = !isConnected
    ? 'disconnected'
    : !isSetupComplete
      ? 'connecting'
      : isSpeaking
        ? 'speaking'
        : isListening
          ? 'listening'
          : 'ready';

  const statusLabel: Record<string, string> = {
    disconnected: 'Disconnected',
    connecting: 'Initializing Gemini…',
    speaking: 'Gemini is speaking…',
    listening: 'Listening…',
    ready: 'Ready'
  };

  const statusColor: Record<string, string> = {
    disconnected: 'text-slate-500',
    connecting: 'text-amber-400',
    speaking: 'text-violet-400',
    listening: 'text-emerald-400',
    ready: 'text-emerald-400'
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #0a0f0d 0%, #0d1a14 30%, #0a1210 60%, #080d0b 100%)',
        fontFamily: "'DM Sans', sans-serif"
      }}
    >
      {/* ─── Ambient Background Glows ───────────────────────────────────── */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.06] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #34d399, transparent 70%)' }} />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />

      {/* ─── Top Bar ───────────────────────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]"
        style={{ background: 'rgba(10, 15, 13, 0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={handleExit}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #059669, #34d399)' }}>
              <Radio size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-tight">ReLife Live</h1>
              <div className={`text-[11px] flex items-center gap-1.5 ${statusColor[connectionState]}`}>
                <StatusDot active={isConnected && isSetupComplete} />
                {statusLabel[connectionState]}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-full text-[11px] font-mono text-slate-400"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span className="flex items-center gap-1">
                <Camera size={11} /> {captureCounter}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle size={11} /> {messages.filter(m => m.role !== 'system').length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────────────────────────── */}
      <div className="h-[calc(100%-57px)] flex flex-col lg:flex-row">
        {/* Left: Camera + Controls */}
        <div className="flex-1 flex flex-col p-4 gap-3">
          {/* Camera Feed */}
          <div className="relative flex-1 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              style={{ opacity: isCameraOn ? 1 : 0.1, transition: 'opacity 0.3s' }}
            />

            {/* Camera overlay corners */}
            {isConnected && (
              <>
                <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400/40 rounded-tl-lg" />
                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400/40 rounded-tr-lg" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400/40 rounded-bl-lg" />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400/40 rounded-br-lg" />
              </>
            )}

            {/* Status Badge */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              {connectionState === 'speaking' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-violet-300"
                  style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.2)', backdropFilter: 'blur(8px)' }}>
                  <Volume2 size={12} className="animate-pulse" /> Gemini speaking
                </div>
              )}
              {connectionState === 'listening' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-300"
                  style={{ background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52, 211, 153, 0.2)', backdropFilter: 'blur(8px)' }}>
                  <Mic size={12} /> Listening
                </div>
              )}
              {connectionState === 'connecting' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-amber-300"
                  style={{ background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.2)', backdropFilter: 'blur(8px)' }}>
                  <Zap size={12} className="animate-spin" /> Connecting
                </div>
              )}
            </div>

            {/* Not connected state */}
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(10, 15, 13, 0.85)' }}>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(52, 211, 153, 0.05))', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
                    <Radio size={28} className="text-emerald-400" />
                  </div>
                  <p className="text-white/60 text-sm mb-1">Gemini Live Interaction</p>
                  <p className="text-white/30 text-xs">Voice + Vision in real-time</p>
                </div>
              </div>
            )}
          </div>

          {/* Audio Level + Controls */}
          <div className="flex items-center gap-3">
            {/* Mic waveform */}
            <div className="flex-1 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <AudioWaveform
                level={isMicMuted ? 0 : micLevel}
                isActive={isListening && !isMicMuted && isConnected}
                color={isSpeaking ? '#a78bfa' : '#34d399'}
              />
            </div>

            {/* Control buttons */}
            <div className="flex gap-2">
              {!isConnected ? (
                <button onClick={connect}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #059669, #34d399)', boxShadow: '0 4px 20px rgba(52, 211, 153, 0.25)' }}>
                  <Wifi size={16} /> Connect
                </button>
              ) : (
                <>
                  <button onClick={toggleMic}
                    className={`p-2.5 rounded-xl transition-all ${isMicMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/[0.06] text-emerald-400 border border-white/[0.06] hover:bg-white/[0.1]'}`}>
                    {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button onClick={toggleCamera}
                    className={`p-2.5 rounded-xl transition-all ${!isCameraOn ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/[0.06] text-emerald-400 border border-white/[0.06] hover:bg-white/[0.1]'}`}>
                    {!isCameraOn ? <CameraOff size={18} /> : <Camera size={18} />}
                  </button>
                  <button onClick={disconnect}
                    className="p-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-all">
                    <WifiOff size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chat Panel */}
        <div className="w-full lg:w-[380px] flex flex-col border-l border-white/[0.06]"
          style={{ background: 'rgba(255,255,255,0.01)' }}>
          {/* Chat Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
            <MessageCircle size={15} className="text-emerald-400" />
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Transcript</span>
          </div>

          {/* Messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center"
                  style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.1)' }}>
                  <Radio size={20} className="text-emerald-500/50" />
                </div>
                <p className="text-white/30 text-sm">
                  {isConnected ? 'Waiting for conversation…' : 'Connect to start talking'}
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'system' ? (
                    <div className="w-full text-center py-2">
                      <span className="text-[11px] text-emerald-400/50 font-mono px-3 py-1 rounded-full"
                        style={{ background: 'rgba(52, 211, 153, 0.06)' }}>
                        {msg.content}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'text-white rounded-br-md'
                          : 'text-slate-200 rounded-bl-md'
                      }`}
                      style={{
                        background: msg.role === 'user'
                          ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(16, 185, 129, 0.12))'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: msg.role === 'user'
                          ? '1px solid rgba(52, 211, 153, 0.15)'
                          : '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Typing indicator when AI is speaking */}
            {isSpeaking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-bl-md"
                  style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.12)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Text Input */}
          <div className="p-3 border-t border-white/[0.06]">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected && isSetupComplete ? 'Type a message…' : 'Connect first…'}
                disabled={!isConnected || !isSetupComplete}
                className="flex-1 px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all disabled:opacity-30"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              />
              <button
                onClick={handleSendText}
                disabled={!textInput.trim() || !isConnected || !isSetupComplete}
                className="p-2.5 rounded-xl transition-all disabled:opacity-20 text-emerald-400 hover:bg-white/[0.06]"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Error Toast ──────────────────────────────────────────────── */}
      {liveError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-3 rounded-xl text-sm text-red-200 flex items-center gap-3"
          style={{ background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.2)', backdropFilter: 'blur(12px)' }}>
          <span>⚠️ {liveError}</span>
          <button onClick={() => {}} className="text-red-300 hover:text-white ml-auto text-lg">×</button>
        </div>
      )}
    </div>
  );
}
