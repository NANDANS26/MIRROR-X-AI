/**
 * pipelineStore.ts — Tracks real-time pipeline progress from WebSocket events.
 * Used by InvestigatorPage to show live stage updates.
 */

import { create } from 'zustand'

export interface PipelineStage {
  stage: string
  stepNumber: number
  totalSteps: number
  label: string
  status: 'pending' | 'active' | 'completed' | 'failed'
}

interface PipelineStore {
  stages: PipelineStage[]
  currentStep: number
  totalSteps: number
  sessionId: string | null
  isActive: boolean
  completedAt: string | null
  aiError: string | null

  startSession: (sessionId: string) => void
  updateStage: (stage: string, stepNumber: number, totalSteps: number, label: string) => void
  completeSession: (aiError?: string) => void
  failSession: (failedStage: string, message: string) => void
  reset: () => void
}

const INITIAL_STAGES: PipelineStage[] = [
  { stage: 'capture',    stepNumber: 1, totalSteps: 5, label: 'Capture',    status: 'pending' },
  { stage: 'rule_engine', stepNumber: 2, totalSteps: 5, label: 'Rule Engine', status: 'pending' },
  { stage: 'ai_analysis', stepNumber: 3, totalSteps: 5, label: 'AI Analysis', status: 'pending' },
  { stage: 'simulation',  stepNumber: 4, totalSteps: 5, label: 'Simulation',  status: 'pending' },
  { stage: 'scoring',     stepNumber: 5, totalSteps: 5, label: 'Scoring',     status: 'pending' },
]

export const usePipelineStore = create<PipelineStore>((set) => ({
  stages: INITIAL_STAGES.map(s => ({ ...s })),
  currentStep: 0,
  totalSteps: 5,
  sessionId: null,
  isActive: false,
  completedAt: null,
  aiError: null,

  startSession: (sessionId) => set({
    sessionId,
    isActive: true,
    completedAt: null,
    aiError: null,
    currentStep: 0,
    stages: INITIAL_STAGES.map(s => ({ ...s, status: 'pending' })),
  }),

  updateStage: (stage, stepNumber, totalSteps, label) => set((state) => ({
    currentStep: stepNumber,
    totalSteps,
    stages: state.stages.map(s => {
      if (s.stepNumber < stepNumber) return { ...s, status: 'completed' }
      if (s.stage === stage)        return { ...s, status: 'active', label }
      return s
    }),
  })),

  completeSession: (aiError) => set((state) => ({
    isActive: false,
    completedAt: new Date().toISOString(),
    aiError: aiError ?? null,
    stages: state.stages.map(s => ({
      ...s,
      status: s.status === 'pending' ? 'completed' : s.status === 'active' ? 'completed' : s.status,
    })),
  })),

  failSession: (failedStage, _message) => set((state) => ({
    isActive: false,
    stages: state.stages.map(s => ({
      ...s,
      status: s.stage === failedStage ? 'failed' : s.status === 'active' ? 'failed' : s.status,
    })),
  })),

  reset: () => set({
    stages: INITIAL_STAGES.map(s => ({ ...s })),
    currentStep: 0,
    totalSteps: 5,
    sessionId: null,
    isActive: false,
    completedAt: null,
    aiError: null,
  }),
}))
