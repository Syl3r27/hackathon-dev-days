'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../lib/store';
import { useCamera } from '../lib/useCamera';
import { analyzeItem } from '../lib/api';
import { Camera, ImagePlus, ArrowLeft, Loader2, Target } from 'lucide-react';

export default function ScanningScreen() {
  const { setPhase, setVisualAnalysis, setDecisions, setSessionId, sessionId, setError } = useAppStore();
  const { videoRef, startCamera, stopCamera, captureFrame } = useCamera();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [procStep, setProcStep] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('gsap').then(({ gsap }) => gsap.fromTo(containerRef.current, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' }));
    
    startCamera()
      .then(() => setReady(true))
      .catch(() => setError('Camera access denied. Use image upload instead.'));

    // Speech recognition for "analyze" / "scan" trigger
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const r = new SR(); r.continuous = true; r.interimResults = false;
      r.onresult = (ev: any) => {
        const t = ev.results[ev.results.length - 1][0].transcript.toLowerCase();
        if (t.includes('analyze') || t.includes('scan') || t.includes('capture')) doCapture();
      };
      r.start();
      return () => { r.stop(); stopCamera(); };
    }
    return () => stopCamera();
  }, []);

  const doCapture = useCallback(async () => {
    if (capturing || !ready) return;
    const frame = captureFrame();
    if (!frame) return;
    setCapturing(true);

    const steps = ['Identifying object...', 'Assessing structural damage...', 'Analyzing repair viability...', 'Structuring recovery plan...'];
    let i = 0;
    setProcStep(steps[0]);
    const iv = setInterval(() => { if (++i < steps.length) setProcStep(steps[i]); }, 1800);

    try {
      const result = await analyzeItem(frame, `Please analyze this item and recommend the most sustainable action.`, sessionId || undefined);
      clearInterval(iv);
      setVisualAnalysis(result.visualAnalysis);
      setDecisions(result.decisions);
      setSessionId(result.sessionId);
      stopCamera();
      import('gsap').then(({ gsap }) => gsap.to(containerRef.current, { opacity: 0, scale: 1.05, duration: 0.5, ease: 'power2.in', onComplete: () => setPhase('decisions') }));
    } catch (err: any) {
      clearInterval(iv);
      setError(err.message || 'Analysis failed. Try again.');
      setCapturing(false);
      setProcStep('');
    }
  }, [capturing, ready, captureFrame, sessionId]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = (ev.target?.result as string)?.split(',')[1];
      if (!b64) return;
      setCapturing(true);
      setProcStep('Processing uploaded image...');
      try {
        const result = await analyzeItem(b64, 'Please analyze this item.', sessionId || undefined);
        setVisualAnalysis(result.visualAnalysis);
        setDecisions(result.decisions);
        setSessionId(result.sessionId);
        stopCamera();
        setPhase('decisions');
      } catch (err: any) { setError(err.message); setCapturing(false); setProcStep(''); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070907] flex flex-col items-center justify-center relative overflow-hidden font-sans text-white">
      
      {/* Background ambient light */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#111611] to-[#070907] pointer-events-none z-0"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vh] h-[120vh] bg-[var(--accent-main)] rounded-full blur-[200px] opacity-[0.03] pointer-events-none z-0"></div>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
        <button onClick={() => { stopCamera(); setPhase('landing'); }} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 hover:pr-5 transition-all border border-white/10 rounded-full text-xs font-semibold tracking-wide uppercase">
          <ArrowLeft size={16} /> Retreat
        </button>
        <div className="font-mono text-xs tracking-[0.3em] font-medium text-[var(--accent-main)] uppercase">Lens Active</div>
        <div className="flex items-center gap-2">
          {ready && <div className="w-2 h-2 rounded-full bg-[var(--accent-main)] animate-pulse"></div>}
          <span className="font-mono text-[10px] tracking-widest text-[#a1a1a1] uppercase">{ready ? 'System Live' : 'Booting...'}</span>
        </div>
      </div>

      {/* Viewfinder Wrapper */}
      <div className="relative z-10 w-full max-w-[480px] aspect-[3/4] mx-auto p-4 flex flex-col justify-center">
        <div className="relative w-full h-full rounded-3xl overflow-hidden bg-black/40 border border-white/10 shadow-2xl backdrop-blur-sm group">
          
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity duration-1000" style={{ opacity: ready ? 0.9 : 0 }} />

          {/* Viewfinder Reticle */}
          {ready && !capturing && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20">
                <Target size={120} strokeWidth={1} />
              </div>
              <div className="cam-corner tl !border-white/40 !w-8 !h-8 !border-l-2 !border-t-2 absolute top-8 left-8 transition-all group-hover:scale-95 group-hover:-translate-x-1 group-hover:-translate-y-1"></div>
              <div className="cam-corner tr !border-white/40 !w-8 !h-8 !border-r-2 !border-t-2 absolute top-8 right-8 transition-all group-hover:scale-95 group-hover:translate-x-1 group-hover:-translate-y-1"></div>
              <div className="cam-corner bl !border-white/40 !w-8 !h-8 !border-l-2 !border-b-2 absolute bottom-8 left-8 transition-all group-hover:scale-95 group-hover:-translate-x-1 group-hover:translate-y-1"></div>
              <div className="cam-corner br !border-white/40 !w-8 !h-8 !border-r-2 !border-b-2 absolute bottom-8 right-8 transition-all group-hover:scale-95 group-hover:translate-x-1 group-hover:translate-y-1"></div>
              <div className="scan-line !bg-gradient-to-r !from-transparent !via-white/30 !to-transparent"></div>
            </div>
          )}

          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/50">
              <Camera size={48} strokeWidth={1} className="opacity-40 animate-pulse" />
              <div className="font-mono text-xs uppercase tracking-[0.2em]">Engaging Optics</div>
            </div>
          )}

          {/* Processing Overlay */}
          {capturing && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center transition-all">
              <Loader2 size={40} className="text-[var(--accent-main)] animate-spin mb-6" />
              <div className="font-mono text-sm tracking-widest text-white uppercase mb-3 text-shadow-sm">{procStep}</div>
              <div className="flex gap-2">
                <div className="w-1 h-1 rounded-full bg-[var(--accent-light)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 rounded-full bg-[var(--accent-light)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 rounded-full bg-[var(--accent-light)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lower Controls */}
      <div className="absolute bottom-12 w-full flex flex-col items-center gap-6 z-20">
        
        {/* Audio Wave indicator */}
        <div className="flex items-center gap-1.5 h-6">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="w-[2px] bg-white/30 rounded-full" style={{ height: '100%', transformOrigin: 'bottom', animation: `waveB ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate`, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>

        {/* Capture Button */}
        <button onClick={doCapture} disabled={!ready || capturing} className={`relative flex items-center justify-center w-20 h-20 rounded-full border-2 transition-all duration-300 ${capturing ? 'border-white/10 bg-white/5 scale-90' : 'border-white/30 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95'}`}>
          {!capturing && <div className="absolute inset-[-10px] rounded-full border border-white/10 animate-ping" style={{ animationDuration: '3s' }}></div>}
          <div className={`w-14 h-14 rounded-full transition-colors ${capturing ? 'bg-transparent' : 'bg-white'}`}></div>
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="text-xs font-medium text-white/50 tracking-wide">
            Tap to capture or say <span className="text-white font-mono uppercase tracking-widest ml-1">"Analyze"</span>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer pt-2 pb-1 text-xs font-semibold text-white/40 hover:text-white transition-colors uppercase tracking-widest border-b border-transparent hover:border-white/20">
            <ImagePlus size={14} /> Upload Image
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>
    </div>
  );
}
