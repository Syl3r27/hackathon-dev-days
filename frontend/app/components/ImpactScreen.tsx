'use client';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { useAuthStore } from '../lib/authStore';
import { useElevenLabs } from '../lib/useElevenLabs';
import { completeAction } from '../lib/api';
import { Leaf, DollarSign, CloudRain, Trash2, Zap, ArrowRight, Volume2 } from 'lucide-react';

export default function ImpactScreen() {
  const { decisions, selectedOption, visualAnalysis, resetAnalysis, setPhase } = useAppStore();
  const { user, setUser } = useAuthStore();
  const { speak, stop } = useElevenLabs();
  const ref = useRef<HTMLDivElement>(null);
  const m = decisions?.impactMetrics || {};

  useEffect(() => {
    import('gsap').then(({ gsap }) => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.2 } });
      tl.fromTo(ref.current, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1 })
        .fromTo('.imp-title', { y: 40, opacity: 0 }, { y: 0, opacity: 1 }, '-=0.9')
        .fromTo('.imp-stat', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.15 }, '-=0.8')
        .fromTo('.imp-insight', { x: -30, opacity: 0 }, { x: 0, opacity: 1 }, '-=0.6')
        .fromTo('.imp-btn', { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1 }, '-=0.5');
    });

    const co2 = m.co2Avoided || 0;
    completeAction(co2, 1);
    if (user) setUser({ ...user, analysisCount: (user.analysisCount || 0) + 1, itemsSaved: (user.itemsSaved || 0) + 1, co2Saved: (user.co2Saved || 0) + co2 });

    const msg = `Congratulations! You just saved ₹${m.moneySaved || 0} and avoided ${co2.toFixed(1)} kilograms of CO2 by choosing to ${selectedOption?.action || 'repair'} your ${visualAnalysis?.objectType || 'item'}. Every repair counts toward a healthier planet. Well done!`;
    setTimeout(() => speak(msg), 800);

    return () => stop();
  }, []);

  const stats = [
    { icon: DollarSign, label: 'Capital Saved', val: `₹${m.moneySaved || 0}`, bg: 'bg-[rgba(92,168,54,0.05)]', border: 'border-green-200', text: 'text-green-800' },
    { icon: CloudRain, label: 'CO₂ Avoided', val: `${(m.co2Avoided || 0).toFixed(1)} kg`, bg: 'bg-[rgba(2,132,199,0.05)]', border: 'border-sky-200', text: 'text-sky-800' },
    { icon: Trash2, label: 'Landfill Diverted', val: m.landfillDiverted || '~1 kg', bg: 'bg-[rgba(154,120,69,0.05)]', border: 'border-amber-200', text: 'text-amber-800' },
    { icon: Zap, label: 'E-Waste Relieved', val: m.ewasteReduced || '~0.5 kg', bg: 'bg-[rgba(124,58,237,0.05)]', border: 'border-purple-200', text: 'text-purple-800' }
  ];

  return (
    <div ref={ref} className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-6 py-20 relative overflow-hidden font-sans">
      
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-[var(--accent-light)] opacity-30 blur-[150px] pointer-events-none z-[-1]"></div>
      
      <div className="max-w-3xl w-full z-10">
        
        <div className="text-center mb-16 imp-title">
          <div className="w-20 h-20 rounded-full bg-[var(--accent-main)] mx-auto flex items-center justify-center shadow-2xl mb-8">
             <Leaf size={36} className="text-white" />
          </div>
          <h1 className="font-serif text-5xl sm:text-7xl font-light tracking-tight text-[var(--text-main)] mb-4">
            Mission <span className="text-[var(--accent-dark)] italic font-semibold">Accomplished</span>
          </h1>
          <p className="text-lg sm:text-xl text-[var(--text-muted)] font-light">
            You successfully chose to <strong className="font-medium text-[var(--text-main)] underline decoration-[var(--accent-light)] decoration-2 underline-offset-4">{selectedOption?.action}</strong> your {visualAnalysis?.objectType || 'item'}.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`imp-stat glass-panel p-6 rounded-[2rem] flex flex-col ${s.bg} ${s.border} border`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white shadow-sm mb-6 ${s.text}`}>
                  <Icon size={24} />
                </div>
                <div className={`font-serif text-4xl font-medium tracking-tight mb-1 ${s.text}`}>{s.val}</div>
                <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[var(--text-muted)] opacity-80">{s.label}</div>
              </div>
            );
          })}
        </div>

        {decisions?.sustainabilityInsight && (
          <div className="imp-insight glass-panel p-8 sm:px-10 rounded-[2rem] border-l-4 border-l-[var(--accent-main)] bg-[rgba(255,255,255,0.8)] mb-16 flex gap-6 items-start">
            <span className="text-3xl">🌍</span>
            <p className="text-base sm:text-lg text-[var(--text-main)] leading-relaxed italic font-serif">
              "{decisions.sustainabilityInsight}"
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button onClick={() => speak(`Well done! You saved ₹${m.moneySaved || 0} and kept ${m.ewasteReduced || 'waste'} out of landfill. ${decisions?.sustainabilityInsight || ''}`)} className="imp-btn w-full sm:w-auto px-6 py-4 rounded-full border border-[var(--glass-border)] bg-white hover:bg-[var(--bg-alt)] transition-colors text-[var(--text-main)] text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm relative group overflow-hidden">
             <Volume2 size={18} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" /> Hear Impact
          </button>
          
          <button onClick={() => { stop(); resetAnalysis(); setPhase('scanning'); }} className="imp-btn w-full sm:w-auto px-10 py-4 rounded-full primary-btn text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover-lift">
            Analyze Next <ArrowRight size={18} />
          </button>
        </div>

        <button onClick={() => { stop(); resetAnalysis(); setPhase('landing'); }} className="imp-btn w-full mt-6 text-xs uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] text-center block transition-colors">
          Return to Portal
        </button>

      </div>
    </div>
  );
}
