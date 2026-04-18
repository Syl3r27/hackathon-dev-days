'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../lib/store';
import { useElevenLabs } from '../lib/useElevenLabs';
import { getRepairStep } from '../lib/api';
import { useFadeIn } from '../lib/useAnimations';
import { ArrowLeft, Mic, MicOff, AlertCircle, Lightbulb as Bulb, Wrench, ChevronRight, ChevronLeft, Flag } from 'lucide-react';

export default function RepairScreen() {
  const { selectedOption, sessionId, currentStepIndex, setCurrentStepIndex, setCurrentStepDetail, currentStepDetail, setPhase, isSpeaking } = useAppStore();
  const { speak, stop } = useElevenLabs();
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stepCardRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const stateRef = useRef({ handleNext: () => {}, speakDetail: (d: any) => {}, currentStepDetail: null as any });

  const steps = selectedOption?.repairSteps || [];
  const total = steps.length || 1;
  const isLast = currentStepIndex >= total - 1;
  const pct = ((currentStepIndex + 1) / total) * 100;

  const speakDetail = useCallback((detail: any) => {
    if (!detail?.detailedInstructions) return;
    speak(detail.detailedInstructions);
  }, [speak]);

  const loadStep = useCallback(async (idx: number) => {
    if (!selectedOption) return;
    stop();
    setLoading(true);
    try {
      const res: any = await getRepairStep(sessionId || '', selectedOption, idx);
      setCurrentStepDetail(res.detail);
      import('gsap').then(({ gsap }) => {
        if (stepCardRef.current) gsap.fromTo(stepCardRef.current, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
      });
      speakDetail(res.detail);
    } catch {
      const fallback = { stepTitle: steps[idx] || `Step ${idx + 1}`, detailedInstructions: steps[idx] || 'Follow the procedure for this step carefully.', warnings: [], tips: [], estimatedTime: 'A few minutes', nextStepHint: '' };
      setCurrentStepDetail(fallback);
      speakDetail(fallback);
    } finally {
      setLoading(false);
    }
  }, [selectedOption, sessionId, steps, stop, speakDetail]);

  const handleNext = useCallback(() => {
    if (isLast) {
      stop();
      import('gsap').then(({ gsap }) => gsap.to(containerRef.current, { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in', onComplete: () => setPhase('impact') }));
    } else {
      const n = currentStepIndex + 1;
      setCurrentStepIndex(n);
      loadStep(n);
    }
  }, [isLast, currentStepIndex, loadStep, stop, setPhase]);

  useFadeIn(containerRef, { duration: 1.0 });

  useEffect(() => {
    stateRef.current = { handleNext, speakDetail, currentStepDetail };
  }, [handleNext, speakDetail, currentStepDetail]);

  useEffect(() => {
    loadStep(currentStepIndex);

    let isUnmounting = false;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = 'en-US';
      recognitionRef.current = r;
      r.onresult = (ev: any) => {
        const t = ev.results[ev.results.length - 1][0].transcript.toLowerCase();
        const { handleNext: _next, speakDetail: _speakDetail, currentStepDetail: _detail } = stateRef.current;
        
        if (['done','next','continue','proceed','finished'].some(k => t.includes(k))) _next();
        else if (['repeat','again','say again'].some(k => t.includes(k))) _speakDetail(_detail);
        else if (['help','explain','tips'].some(k => t.includes(k))) {
          const tips = _detail?.tips?.join('. ') || 'Take your time with this step. Check the instructions carefully.';
          speak(tips);
        }
      };
      r.onend = () => {
        if (!isUnmounting) {
          try { r.start(); } catch (e) { console.error('Failed to restart speech recognition', e) }
        }
      };
      try { r.start(); } catch (e) { console.error('Failed to start speech recognition', e) }
    }
    return () => { isUnmounting = true; recognitionRef.current?.stop(); stop(); };
  }, []);

  if (!selectedOption) return null;

  return (
    <div ref={containerRef} className="min-h-screen bg-[var(--bg-main)] flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Absolute Noise Layer happens globally, but add a soft gradient here */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-alt)] to-[var(--bg-main)] pointer-events-none z-[-1]"></div>

      {/* Header Panel */}
      <div className="sticky top-0 w-full z-40 bg-[rgba(250,247,242,0.8)] backdrop-blur-xl border-b border-[var(--accent-light)] transition-all">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <button onClick={() => { stop(); setPhase('decisions'); }} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
            <ArrowLeft size={16} /> Pathways
          </button>
          
          <div className="hidden sm:flex flex-col items-center">
            <div className="font-serif text-lg text-[var(--text-main)] font-medium mb-1">{selectedOption.action}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent-dark)]">
              Phase {currentStepIndex + 1} // {total}
            </div>
          </div>

          <div className="flex items-center gap-4">
             {isSpeaking ? (
                <div className="flex items-center gap-1.5 h-4 w-12 justify-center">
                  {[1,2,3,4].map((h, i) => <div key={i} className="w-[2px] bg-[var(--accent-dark)] rounded-full animate-pulse" style={{ height: `${h * 20 + 20}%`, animationDuration: `${0.4 + i*0.1}s`, animationDelay: `${i*0.1}s` }} />)}
                </div>
             ) : (
                <Mic size={16} className="text-[var(--text-muted)]" />
             )}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-[2px] w-full bg-[var(--accent-light)] opacity-50 relative">
          <div className="absolute top-0 left-0 h-full bg-[var(--accent-main)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${pct}%` }}></div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 flex flex-col justify-center">
        
        {/* Step Navigation Dots (desktop) */}
        {total > 1 && (
          <div className="flex items-center gap-2 mb-10 w-full max-w-2xl mx-auto justify-center overflow-x-auto pb-2 scrollbar-hide mask-edges">
            {steps.map((_: any, i: number) => {
              const done = i < currentStepIndex;
              const active = i === currentStepIndex;
              return (
                <div key={i} className="flex items-center gap-2">
                  <button onClick={() => { setCurrentStepIndex(i); loadStep(i); }} className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs transition-all duration-300 ${active ? 'bg-[var(--accent-main)] text-white scale-110 shadow-lg' : done ? 'bg-[var(--accent-light)] text-[var(--accent-dark)]' : 'bg-[var(--bg-alt)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent-light)]'}`}>
                    {done ? '✓' : i + 1}
                  </button>
                  {i < steps.length - 1 && <div className={`w-6 h-[1px] ${i < currentStepIndex ? 'bg-[var(--accent-main)]' : 'bg-[var(--glass-border)]'}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Main Instruction Card */}
        <div ref={stepCardRef} className="glass-panel p-8 sm:p-12 rounded-[2rem] w-full flex-1 flex flex-col justify-center min-h-[400px]">
          {loading ? (
            <div className="space-y-6 w-full max-w-2xl mx-auto">
              {[80, 100, 60].map((w, i) => <div key={i} className="h-4 bg-[var(--bg-alt)] rounded-full animate-pulse" style={{ width: `${w}%`, animationDelay: `${i*100}ms` }} />)}
            </div>
          ) : currentStepDetail ? (
            <div className="max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 rounded-xl bg-[var(--accent-main)] flex items-center justify-center font-serif text-xl font-bold text-white shadow-md">
                   {currentStepIndex + 1}
                 </div>
                 <h2 className="text-2xl sm:text-3xl font-serif text-[var(--text-main)] leading-tight">{currentStepDetail.stepTitle}</h2>
              </div>
              
              <p className="text-lg sm:text-xl text-[var(--text-main)] font-light leading-relaxed mb-10 text-pretty">
                {currentStepDetail.detailedInstructions}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tools needed */}
                {selectedOption.toolsNeeded && selectedOption.toolsNeeded.length > 0 && (
                  <div className="bg-[rgba(255,255,255,0.4)] border border-[var(--accent-light)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-3">
                      <Wrench size={14} /> Tools Required
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {selectedOption.toolsNeeded.map((t: string) => <span key={t} className="px-3 py-1 bg-white rounded-full text-xs font-mono font-medium border border-[var(--glass-border)] shadow-sm text-[var(--text-main)]">{t}</span>)}
                    </div>
                  </div>
                )}
                
                {currentStepDetail.estimatedTime && (
                   <div className="bg-[rgba(255,255,255,0.4)] border border-[var(--accent-light)] rounded-2xl p-5 flex flex-col justify-center">
                     <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">Time Estimate</div>
                     <div className="text-lg font-serif text-[var(--accent-dark)]">{currentStepDetail.estimatedTime}</div>
                   </div>
                )}
              </div>

              {/* Warnings & Tips */}
              {(currentStepDetail.warnings?.length > 0 || currentStepDetail.tips?.length > 0) && (
                <div className="mt-6 flex flex-col gap-4">
                  {currentStepDetail.warnings?.length > 0 && (
                    <div className="bg-[#fff4f2] border-l-4 border-[#e07a5f] p-5 rounded-r-xl">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#e07a5f] mb-2">
                        <AlertCircle size={14} /> Attention
                      </div>
                      <ul className="space-y-1">
                        {currentStepDetail.warnings.map((w: string, i: number) => <li key={i} className="text-sm text-[#8a4e40] font-medium leading-relaxed">{w}</li>)}
                      </ul>
                    </div>
                  )}
                  {currentStepDetail.tips?.length > 0 && (
                    <div className="bg-[#f0f5ed] border-l-4 border-[#758d6e] p-5 rounded-r-xl">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#5e635b] mb-2">
                        <Bulb size={14} /> Expert Tip
                      </div>
                      <ul className="space-y-1">
                        {currentStepDetail.tips.map((t: string, i: number) => <li key={i} className="text-sm text-[#5e635b] font-medium leading-relaxed">{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

      </div>

      {/* Bottom Control Bar */}
      <div className="sticky bottom-0 w-full bg-[rgba(250,247,242,0.9)] backdrop-blur-xl border-t border-[var(--glass-border)] py-4 px-6 z-40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="text-xs font-mono text-[var(--text-muted)] capitalize opacity-80 hidden sm:block">
            Voice Command: "Next", "Repeat", "Help"
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            {currentStepIndex > 0 && (
              <button disabled={loading} onClick={() => { const p = currentStepIndex - 1; setCurrentStepIndex(p); loadStep(p); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-white border border-[var(--glass-border)] rounded-full hover:bg-[var(--bg-alt)] transition-colors text-sm font-semibold uppercase tracking-wider text-[var(--text-main)] shadow-sm">
                <ChevronLeft size={16} /> Prev
              </button>
            )}
            <button disabled={loading} onClick={handleNext} className="flex-[2] sm:flex-none flex items-center justify-center gap-2 px-8 py-4 primary-btn rounded-full text-sm font-semibold uppercase tracking-wider shadow-lg">
              {loading ? (
                <div className="flex items-center gap-2"><div className="dot w-1.5 h-1.5 bg-white"/><div className="dot w-1.5 h-1.5 bg-white"/><div className="dot w-1.5 h-1.5 bg-white"/></div>
              ) : isLast ? (
                <><Flag size={16} /> Finish Repair</>
              ) : (
                <>Next Phase <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
