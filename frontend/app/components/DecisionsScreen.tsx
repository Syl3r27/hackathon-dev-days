'use client';
import { useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../lib/store';
import { useElevenLabs } from '../lib/useElevenLabs';
import { useStaggerFadeIn } from '../lib/useAnimations';
import { ArrowLeft, Cpu, Activity, Lightbulb, Volume2, Star, Clock, HeartHandshake, RefreshCw, Hammer, HardDrive, Leaf } from 'lucide-react';

const ICONS: Record<string, any> = { Repair: Hammer, 'Replace Component': HardDrive, 'Resell for Parts': Activity, Donate: HeartHandshake, Recycle: RefreshCw };

function Ring({ score }: { score: number }) {
  const c = 2 * Math.PI * 26;
  const off = c - (score / 10) * c;
  const col = score >= 8 ? '#758d6e' : score >= 6 ? '#5e635b' : '#c0392b';
  return (
    <div className="relative flex items-center justify-center">
      <svg width="60" height="60" viewBox="0 0 60 60" className="transform -rotate-90">
        <circle cx="30" cy="30" r="26" fill="none" stroke="var(--bg-alt)" strokeWidth="4" />
        <circle cx="30" cy="30" r="26" fill="none" stroke={col} strokeWidth="4" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-serif text-lg font-semibold" style={{ color: col }}>{score}</div>
    </div>
  );
}

export default function DecisionsScreen() {
  const { visualAnalysis, decisions, setSelectedOption, setPhase, setCurrentStepIndex, isSpeaking } = useAppStore();
  const { speak, stop } = useElevenLabs();
  const ref = useRef<HTMLDivElement>(null);

  const animConfig = useMemo(() => [
    { selector: '.diag-blk', x: -30 },
    { selector: '.opt-card', y: 40, stagger: 0.12 }
  ], []);
  useStaggerFadeIn(ref, animConfig);

  useEffect(() => {
    if (decisions?.recommendation) {
      const msg = `I've analyzed your ${visualAnalysis?.objectType || 'item'}. ${decisions.recommendationReason} My recommendation is: ${decisions.recommendation}.`;
      const timer = setTimeout(() => speak(msg), 700);
      return () => clearTimeout(timer);
    }
  }, [decisions, visualAnalysis?.objectType, speak]);

  useEffect(() => () => stop(), [stop]);

  const pick = (opt: any) => {
    stop();
    import('gsap').then(({ gsap }) => {
      gsap.to(ref.current, { opacity: 0, x: -40, duration: 0.4, ease: 'power3.inOut', onComplete: () => {
        setSelectedOption(opt); setCurrentStepIndex(0); setPhase('repairing');
      }});
    });
  };

  if (!decisions) return null;
  const sorted = [...(decisions.options || [])].sort((a: any, b: any) => b.environmentalImpact.score - a.environmentalImpact.score);

  return (
    <div ref={ref} className="min-h-screen relative font-sans pt-24 pb-20 px-6 max-w-4xl mx-auto">
      
      {/* Dynamic Earthy Background Elements */}
      <div className="fixed top-[10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--accent-light)] opacity-30 blur-[100px] pointer-events-none z-[-1]"></div>

      {/* Navigation */}
      <div className="fixed top-0 left-0 w-full glass-panel z-50 border-b-0 border-t-0 px-6 py-4 flex justify-between items-center bg-[rgba(250,247,242,0.8)]">
        <button onClick={() => { stop(); setPhase('scanning'); }} className="flex items-center gap-2 hover:opacity-70 transition-opacity font-medium text-sm text-[var(--text-muted)] uppercase tracking-widest">
          <ArrowLeft size={16} /> Rescan
        </button>
        <div className="hidden sm:flex items-center gap-2">
          {isSpeaking && (
            <div className="flex gap-1 items-center h-4 mr-2">
              {[1,2,3,4].map(i => <div key={i} className="wb bg-[var(--text-main)] w-[2px] rounded-full" style={{ height: '100%', animationDuration: `${0.4 + i * 0.1}s` }} />)}
            </div>
          )}
          <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--text-main)] font-semibold">{isSpeaking ? 'AI Voice Active' : 'Analysis Complete'}</span>
        </div>
      </div>

      {/* Top Diagnosis Header */}
      <div className="mb-14 diag-blk">
        <div className="flex items-end justify-between font-serif mb-6 border-b border-[var(--accent-light)] pb-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl text-[var(--text-main)] leading-[1.1] max-w-[80%]">
            {visualAnalysis?.objectType || 'Unidentified Item'}
          </h1>
          <Cpu className="text-[var(--accent-main)] mb-2" size={32} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Visual Diagnostics</h3>
            <p className="text-base text-[var(--text-main)] leading-relaxed font-medium">
              {visualAnalysis?.summary}
            </p>
            <div className="flex gap-4 pt-2">
              <span className="px-3 py-1 bg-[var(--bg-alt)] rounded-md text-xs font-mono uppercase">Cond: {visualAnalysis?.condition}</span>
              {visualAnalysis?.repairability && <span className="px-3 py-1 bg-[var(--bg-alt)] rounded-md text-xs font-mono uppercase">Rep: {visualAnalysis.repairability}</span>}
            </div>
          </div>
          
          {decisions.diagnosis && (
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent-main)]"></div>
              <Activity size={20} className="text-[var(--accent-main)] mb-3" />
              <div className="text-sm font-semibold text-[var(--text-main)] mb-1">{decisions.diagnosis.primaryIssue}</div>
              <div className="text-sm text-[var(--text-muted)] mt-2 italic font-serif">"{decisions.diagnosis.likelyCause}"</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Recommendation AI Block */}
      <div className="glass-panel rounded-3xl p-8 mb-16 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden border border-[var(--accent-main)] bg-[rgba(250,247,242,0.9)] hover-lift">
        <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-[var(--accent-main)] flex items-center justify-center shadow-lg">
          <Lightbulb size={28} className="text-white" />
        </div>
        <div className="flex-1 pr-12">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[var(--accent-dark)] mb-2">Gemini Recommendation</h2>
          <div className="text-2xl font-serif text-[var(--text-main)] mb-3">{decisions.recommendation}</div>
          <p className="text-base text-[var(--text-muted)] leading-relaxed">{decisions.recommendationReason}</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); speak(`${decisions.recommendationReason}`); }} className="absolute top-8 right-8 w-10 h-10 rounded-full border border-[var(--accent-light)] flex items-center justify-center hover:bg-[var(--accent-light)] transition-colors text-[var(--text-main)]">
          <Volume2 size={18} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="h-[1px] flex-1 bg-[var(--accent-light)]"></div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] px-2">Pathways ({sorted.length})</span>
        <div className="h-[1px] flex-1 bg-[var(--accent-light)]"></div>
      </div>

      {/* Options Stack */}
      <div className="flex flex-col gap-5">
        {sorted.map((opt: any, idx: number) => {
          const isRec = opt.action === decisions.recommendation || opt.recommended;
          const cost = opt.estimatedCost.min === 0 && opt.estimatedCost.max === 0 ? 'Free' : `₹${opt.estimatedCost.min}–₹${opt.estimatedCost.max}`;
          const IconObj = ICONS[opt.action] || RefreshCw;
          
          return (
            <div key={opt.action} onClick={() => pick(opt)} className={`opt-card relative glass-panel rounded-2xl p-6 sm:p-8 cursor-pointer hover-lift group border ${isRec ? 'border-[var(--accent-main)] shadow-md' : 'border-transparent hover:border-[var(--glass-border)]'}`}>
              
              {isRec && (
                <div className="absolute top-0 right-8 bg-[var(--accent-main)] text-white text-[10px] uppercase tracking-widest font-bold py-1 px-3 rounded-b-lg flex items-center gap-1 shadow-sm">
                  <Star size={10} className="fill-white" /> Optimal Path
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start gap-6">
                
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-[var(--bg-alt)] group-hover:bg-[var(--accent-light)] transition-colors flex items-center justify-center">
                  <IconObj size={24} className="text-[var(--text-main)]" />
                </div>
                
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start w-full">
                    <div>
                      <h3 className="text-xl font-serif font-medium text-[var(--text-main)]">{opt.action}</h3>
                      <p className="text-sm text-[var(--text-muted)] mt-1 mb-6 leading-relaxed max-w-sm">{opt.description}</p>
                    </div>
                    <div className="hidden sm:block ml-4 pointer-events-none">
                      <Ring score={opt.environmentalImpact.score} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 border-t border-[var(--accent-light)] pt-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">Cost</span>
                      <span className="text-sm font-medium text-[var(--text-main)] font-mono">{cost}</span>
                    </div>
                    <div className="flex flex-col border-l border-[var(--accent-light)] pl-2 sm:pl-4">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">Time</span>
                      <span className="text-sm font-medium text-[var(--text-main)] flex items-center gap-1.5"><Clock size={12} /> {opt.timeRequired}</span>
                    </div>
                    <div className="flex flex-col border-l border-[var(--accent-light)] pl-2 sm:pl-4">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">Effort</span>
                      <span className="text-sm font-medium text-[var(--text-main)] capitalize">{opt.difficulty}</span>
                    </div>
                  </div>
                  
                  <div className="sm:hidden mt-6 pt-4 border-t border-[var(--accent-light)] flex justify-between items-center">
                     <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-semibold">Eco Score</span>
                     <Ring score={opt.environmentalImpact.score} />
                  </div>

                </div>
              </div>

              <div className="absolute inset-0 border-2 border-transparent group-hover:border-[var(--accent-light)] rounded-2xl transition-colors pointer-events-none"></div>
            </div>
          );
        })}
      </div>

      {decisions.sustainabilityInsight && (
        <div className="mt-16 text-center max-w-xl mx-auto opt-card">
           <Leaf size={24} className="mx-auto mb-4 text-[var(--accent-main)] opacity-50" />
           <p className="font-serif text-lg lg:text-xl text-[var(--text-muted)] italic leading-relaxed">
             "{decisions.sustainabilityInsight}"
           </p>
        </div>
      )}

    </div>
  );
}
