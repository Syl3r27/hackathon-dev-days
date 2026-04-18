'use client';
import { create } from 'zustand';

export type AppPhase = 'auth' | 'landing' | 'scanning' | 'decisions' | 'repairing' | 'impact' | 'realtime';

interface AppState {
  phase: AppPhase;
  sessionId: string | null;
  visualAnalysis: any;
  decisions: any;
  selectedOption: any;
  currentStepIndex: number;
  currentStepDetail: any;
  isProcessing: boolean;
  isSpeaking: boolean;
  error: string | null;

  setPhase: (p: AppPhase) => void;
  setSessionId: (id: string | null) => void;
  setVisualAnalysis: (v: any) => void;
  setDecisions: (d: any) => void;
  setSelectedOption: (o: any) => void;
  setCurrentStepIndex: (i: number) => void;
  setCurrentStepDetail: (d: any) => void;
  setIsProcessing: (v: boolean) => void;
  setIsSpeaking: (v: boolean) => void;
  setError: (e: string | null) => void;
  resetAnalysis: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  phase: 'auth',
  sessionId: null,
  visualAnalysis: null,
  decisions: null,
  selectedOption: null,
  currentStepIndex: 0,
  currentStepDetail: null,
  isProcessing: false,
  isSpeaking: false,
  error: null,

  setPhase: (phase) => set({ phase }),
  setSessionId: (sessionId) => set({ sessionId }),
  setVisualAnalysis: (visualAnalysis) => set({ visualAnalysis }),
  setDecisions: (decisions) => set({ decisions }),
  setSelectedOption: (selectedOption) => set({ selectedOption }),
  setCurrentStepIndex: (currentStepIndex) => set({ currentStepIndex }),
  setCurrentStepDetail: (currentStepDetail) => set({ currentStepDetail }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setError: (error) => set({ error }),
  resetAnalysis: () => set({
    visualAnalysis: null, decisions: null, selectedOption: null,
    currentStepIndex: 0, currentStepDetail: null, sessionId: null,
    error: null, isSpeaking: false
  })
}));
