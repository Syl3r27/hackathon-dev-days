'use client';
import { useAppStore } from './lib/store';
import { useAuthStore } from './lib/authStore';
import AppInitializer from './components/AppInitializer';
import AuthScreen from './components/AuthScreen';
import LandingScreen from './components/LandingScreen';
import ScanningScreen from './components/ScanningScreen';
import DecisionsScreen from './components/DecisionsScreen';
import RepairScreen from './components/RepairScreen';
import ImpactScreen from './components/ImpactScreen';

function ErrorToast() {
  const { error, setError } = useAppStore();
  if (!error) return null;
  return (
    <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: '#fff1f0', border: '1px solid #fca5a5', borderRadius: 12, padding: '0.7rem 1.2rem', zIndex: 200, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 16px rgba(0,0,0,.12)', fontSize: '0.875rem', color: '#991b1b', fontFamily: 'var(--fb)' }}>
      <span>⚠️ {error}</span>
      <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: '#991b1b', cursor: 'pointer', lineHeight: 1 }}>×</button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(155deg,#f5f0e8,#edf5e8)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#3d8a20,#5ca836)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 1rem', boxShadow: '0 6px 20px rgba(61,138,32,0.28)', animation: 'spin 2s linear infinite' }}>♻️</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <div className="dot" /><div className="dot" /><div className="dot" />
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

export default function Page() {
  const { phase } = useAppStore();
  const { isInitialized } = useAuthStore();

  return (
    <AppInitializer>
      <ErrorToast />
      {!isInitialized ? <LoadingScreen /> : (
        <>
          {phase === 'auth' && <AuthScreen />}
          {phase === 'landing' && <LandingScreen />}
          {phase === 'scanning' && <ScanningScreen />}
          {phase === 'decisions' && <DecisionsScreen />}
          {phase === 'repairing' && <RepairScreen />}
          {phase === 'impact' && <ImpactScreen />}
        </>
      )}
    </AppInitializer>
  );
}
