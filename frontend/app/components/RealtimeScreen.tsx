'use client';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { useRealtimeInteraction } from '../lib/useRealtimeInteraction';
import { Play, Pause, MessageCircle, Mic } from 'lucide-react';

export default function RealtimeScreen() {
  const { setPhase } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    videoRef,
    isRunning,
    messages,
    currentResponse,
    isProcessing,
    captureCounter,
    isListening,
    start,
    stop,
    handleUserInput
  } = useRealtimeInteraction();

  useEffect(() => {
    import('gsap').then(({ gsap }) => 
      gsap.fromTo(containerRef.current, 
        { opacity: 0, scale: 0.98 }, 
        { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' }
      )
    );
  }, []);

  const handleTestInput = () => {
    const input = prompt('Enter your question:');
    if (input?.trim()) {
      handleUserInput(input.trim());
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 overflow-hidden"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/40 to-transparent p-6 flex justify-between items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-emerald-300">Real-Time Interaction</h1>
          <p className="text-sm text-emerald-200/60">
            {isRunning ? 'Live • ' : 'Stopped • '}
            Frames: {captureCounter} • {isProcessing ? 'Processing...' : 'Ready'}
          </p>
        </div>
        <button
          onClick={() => setPhase('landing')}
          className="px-4 py-2 bg-red-900/40 hover:bg-red-800/60 text-red-200 rounded-lg text-sm font-medium transition"
        >
          Exit
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="h-full flex flex-col lg:flex-row gap-4 p-6 pt-24">
        {/* Left: Camera Feed */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative flex-1 bg-black/30 rounded-2xl overflow-hidden border border-emerald-500/20">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/10 rounded-2xl" />
            
            {/* Status overlay */}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
              {isRunning && (
                <>
                  <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    {isListening ? 'Listening...' : 'Analyzing...'}
                  </div>
                  <div className="text-xs text-emerald-300/60 mt-1">
                    Frame #{captureCounter}
                  </div>
                </>
              )}
              {!isRunning && (
                <div className="text-emerald-200/60 text-sm">Ready to start</div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3 justify-center">
            {!isRunning ? (
              <button
                onClick={start}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition shadow-lg"
              >
                <Play size={20} /> Start Real-Time
              </button>
            ) : (
              <button
                onClick={stop}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition shadow-lg"
              >
                <Pause size={20} /> Stop
              </button>
            )}
            <button
              onClick={handleTestInput}
              disabled={!isRunning}
              className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
            >
              <Mic size={20} /> Manual Input
            </button>
          </div>
        </div>

        {/* Right: Chat & Response */}
        <div className="w-full lg:w-96 flex flex-col gap-4">
          {/* Current Response */}
          {currentResponse && (
            <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/30 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <p className="text-sm font-semibold text-emerald-300">Current Response</p>
              </div>
              <p className="text-sm text-emerald-100 leading-relaxed">
                {currentResponse}
              </p>
              {isProcessing && (
                <div className="mt-3 flex gap-1">
                  <div className="w-1 h-6 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-6 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-6 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          )}

          {/* Conversation History */}
          <div className="flex-1 bg-black/20 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
              <MessageCircle size={18} className="text-emerald-400" />
              <h3 className="font-semibold text-sm text-slate-200">Conversation</h3>
              <span className="ml-auto text-xs text-slate-400">{messages.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">
                  Start real-time interaction to begin conversation...
                </p>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-100'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-800/30 rounded-lg p-3">
            <div>
              <p className="text-slate-400">Frames Captured</p>
              <p className="text-lg font-bold text-emerald-400">{captureCounter}</p>
            </div>
            <div>
              <p className="text-slate-400">Messages</p>
              <p className="text-lg font-bold text-emerald-400">{messages.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
