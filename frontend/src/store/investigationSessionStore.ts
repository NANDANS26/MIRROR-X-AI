/**
 * investigationSessionStore.ts
 *
 * CRITICAL: sessionId must be stored explicitly for report + chat use.
 * The session object also holds full analysis results.
 */

import { create } from 'zustand'
import type { InvestigationSession } from '../types/session'

interface SessionStore {
  session: InvestigationSession | null
  sessionId: string | null        // ← explicit sessionId field for report/chat

  setSession: (session: InvestigationSession) => void
  setSessionId: (id: string) => void
  clearSession: () => void
}

export const useInvestigationSessionStore = create<SessionStore>((set) => ({
  session: null,
  sessionId: null,

  setSession: (session) => set({ session }),
  setSessionId: (id) => set({ sessionId: id }),
  clearSession: () => set({ session: null, sessionId: null }),
}))
