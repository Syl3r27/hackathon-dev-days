'use client';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../lib/authStore';
import { useAppStore } from '../lib/store';
import { authLogout } from '../lib/api';
import { Leaf, LogOut, Camera, Recycle, Wrench, Zap } from 'lucide-react';

export default function LandingScreen() {
  const { user, clearAuth } = useAuthStore();
  const { setPhase } = useAppStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('gsap').then(({ gsap }) => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.4 } });
      tl.fromTo('.ll-logo', { y: 40, opacity: 0 }, { y: 0, opacity: 1 })
        .fromTo('.ll-h1', { y: 60, opacity: 0, rotationX: 20 }, { y: 0, opacity: 1, rotationX: 0, stagger: 0.15 }, '-=1.1')
        .fromTo('.ll-sub', { y: 30, opacity: 0 }, { y: 0, opacity: 1 }, '-=1.0')
        .fromTo('.ll-stat', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1 }, '-=0.9')
        .fromTo('.ll-cta', { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1 }, '-=0.8');

      // Floating icons animation
      gsap.utils.toArray('.ll-float').forEach((el: any) => {
        gsap.to(el, {
          y: `-=` + (Math.random() * 40 + 20),
          rotation: Math.random() * 20 - 10,
          duration: Math.random() * 3 + 3,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: Math.random() * -3
        });
      });
    });
  }, []);

  const handleLogout = async () => {
    await authLogout().catch(() => {});
    clearAuth();
    setPhase('auth');
  };

  const handleStart = () => {
    import('gsap').then(({ gsap }) => {
      gsap.to(ref.current, { opacity: 0, y: -40, duration: 0.6, ease: 'power3.in', onComplete: () => setPhase('scanning') });
    });
  };

  const stats = [
    { v: '50M+', l: 'Tons e-waste/yr' },
    { v: '80%', l: 'Items repairable' },
    { v: '₹40,000', l: 'Avg saved/item' }
  ];

  const floatingIcons = [Leaf, Recycle, Wrench, Zap, Leaf];

  return (
    <div ref={ref} className="min-h-screen w-full relative flex flex-col items-center justify-center pt-24 pb-16 px-6 lg:px-16 overflow-hidden">
      
      {/* Dynamic Earthy Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--accent-light)] opacity-20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[var(--accent-main)] opacity-10 blur-[150px] pointer-events-none"></div>

      {floatingIcons.map((Icon, i) => (
        <div key={i} className="ll-float absolute text-[var(--accent-main)] opacity-20 pointer-events-none" style={{
          top: `${15 + i * 18}%`,
          ...(i % 2 === 0 ? { left: `${8 + i * 4}%` } : { right: `${8 + i * 4}%` })
        }}>
          <Icon size={32} />
        </div>
      ))}

      {/* Top Navigation */}
      <nav className="absolute top-0 left-0 w-full p-6 lg:px-12 flex justify-between items-center z-20 ll-logo">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1a1c19] flex items-center justify-center text-white">
            <Leaf size={18} className="text-[#faf7f2]" />
          </div>
          <span className="font-mono text-xs tracking-[0.2em] font-medium text-[#1a1c19] uppercase">ReLife AI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-sm font-medium text-[var(--text-muted)]">Signed in as {user?.name?.split(' ')[0]}</span>
          <button onClick={handleLogout} className="glass-panel hover-lift rounded-full p-2.5 px-4 flex items-center gap-2 text-sm font-medium text-[var(--text-main)]">
            <span className="hidden sm:inline">Sign Out</span> <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center text-center mt-8">
        
        <div className="perspective-1000 mb-8">
          <h1 className="ll-h1 font-serif text-[clamp(4rem,10vw,8.5rem)] leading-[0.95] tracking-tight text-[var(--text-main)] block">
            Repair the
          </h1>
          <h1 className="ll-h1 font-serif text-[clamp(4rem,10vw,8.5rem)] leading-[0.95] tracking-tight block">
            <span className="text-[var(--accent-main)] italic">World</span> around you
          </h1>
        </div>

        <p className="ll-sub text-lg lg:text-xl font-sans text-[var(--text-muted)] max-w-2xl mb-14 leading-relaxed font-light">
          A new paradigm for sustainable living. Point your camera at any broken household item, and let Gemini AI guide your repair journey in real time.
        </p>

        {/* User Stats if active */}
        {(user?.analysisCount ?? 0) > 0 && (
          <div className="flex gap-4 mb-16 flex-wrap justify-center ll-sub">
            {[
              { v: user?.analysisCount || 0, l: 'Analyses Done' },
              { v: user?.itemsSaved || 0, l: 'Items Saved' },
              { v: `${(user?.co2Saved || 0).toFixed(1)}kg`, l: 'CO₂ Avoided' }
            ].map(s => (
              <div key={s.l} className="glass-panel px-6 py-4 rounded-3xl flex flex-col items-center border-[var(--accent-light)]">
                <span className="font-serif text-3xl font-bold text-[var(--accent-dark)]">{s.v}</span>
                <span className="text-xs uppercase tracking-widest font-semibold mt-1 text-[var(--text-muted)]">{s.l}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleStart} className="ll-cta primary-btn py-5 px-10 text-lg shadow-lg mb-20 group">
          <span className="flex items-center gap-3">
            <span className="bg-white/20 p-2 rounded-full group-hover:scale-110 transition-transform"><Camera size={20} /></span>
            Start Diagnostics
          </span>
        </button>

        {/* Global Impact Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl border-t border-[var(--accent-light)] pt-12">
          {stats.map(s => (
            <div key={s.v} className="ll-stat flex flex-col items-center">
              <span className="font-serif text-4xl lg:text-5xl text-[var(--text-main)] mb-2">{s.v}</span>
              <span className="font-sans text-sm tracking-wide text-[var(--text-muted)]">{s.l}</span>
            </div>
          ))}
        </div>
        
        <p className="ll-stat mt-12 text-xs uppercase tracking-[0.2em] font-mono text-[var(--text-muted)]">
          Powered by Gemini 2.0 Flash Intelligent Vision
        </p>

      </div>
    </div>
  );
}
