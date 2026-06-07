/**
 * useWebSocket.ts — Socket.io client hook for real-time investigation progress.
 *
 * Handles session_started, stage_progress, session_complete, session_failed events.
 * Manages reconnection failure notification.
 *
 * Validates: Requirements 11.1, 11.3, 11.4, 11.5, 11.6
 */

import { useEffect, useRef } from 'react'
import socket from '../services/socket'
import { useAgentStore } from '../store/agentStore'
import { useChatStore } from '../store/chatStore'
import { useActivityStore } from '../store/activityStore'
import { usePipelineStore } from '../store/pipelineStore'
import { useInvestigationSessionStore } from '../store/investigationSessionStore'
import { createNarrativeMessages } from '../services/investigationNarrator'
import api from '../services/api'

interface StageProgressPayload {
  stage: string
  stepNumber: number
  totalSteps: number
  label: string
}

interface SessionCompletePayload {
  sessionId: string
  ai_error?: string
  quota_exceeded?: boolean
}

interface SessionFailedPayload {
  sessionId: string
  failedStage: string
  message: string
}

export function useWebSocket() {
  const { setState } = useAgentStore()
  const { addMessage, setActiveChips } = useChatStore()
  const { addEvent } = useActivityStore()
  const { startSession, updateStage, completeSession, failSession } = usePipelineStore()
  const { setSession, setSessionId } = useInvestigationSessionStore()

  const reconnectAttemptsRef = useRef(0)

  useEffect(() => {
    const handleSessionStarted = (payload: { sessionId: string }) => {
      setState('investigating')
      addEvent('Investigation session started')
      startSession(payload.sessionId)
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'status',
        content: 'Investigation started. Initializing forensic pipeline...',
        timestamp: new Date().toISOString(),
      })
    }

    const handleStageProgress = (payload: StageProgressPayload) => {
      const { label, stepNumber, totalSteps, stage } = payload

      addEvent(`Stage ${stepNumber}/${totalSteps}: ${label}`)
      updateStage(stage, stepNumber, totalSteps, label)

      const stageMessages: Record<string, string> = {
        capture: 'Capturing visual evidence from the interface...',
        rule_engine: 'Scanning for dark pattern signatures...',
        ai_analysis: 'Deep-analyzing manipulation techniques with AI...',
        simulation: 'Simulating behavioral impact across four user personas...',
        scoring: 'Computing risk scores and fairness index...',
      }

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'status',
        content: stageMessages[stage] ?? label,
        timestamp: new Date().toISOString(),
      })
    }

    const handleSessionComplete = async (payload: SessionCompletePayload) => {
      setState('explaining')
      addEvent('Analysis complete — processing results')
      completeSession(payload.ai_error)

      if (payload.ai_error) {
        addMessage({
          id: crypto.randomUUID(), role: 'assistant', type: 'message',
          content: payload.ai_error, timestamp: new Date().toISOString(),
        })
      }

      // FIX: Fetch full session results from backend and populate session store
      // This is the critical step — without this, URL analysis results never reach the UI
      if (payload.sessionId) {
        try {
          setSessionId(payload.sessionId)
          const response = await api.get(`/analysis/${payload.sessionId}`)
          const sessionData = response.data?.session || response.data

          // Build the analysis object from the persisted session
          const analysis = {
            session_id: payload.sessionId,
            detected_patterns: sessionData.detectedPatternsJson || sessionData.detectedPatterns || [],
            simulation_results: sessionData.simulationResultsJson || sessionData.simulationResults || [],
            scores: sessionData.scoresJson || sessionData.scores || null,
            ai_analysis: sessionData.ocrResultJson ? '' : null,
          }

          setSession({
            image: sessionData.screenshotPath
              ? `http://localhost:3001/uploads/${sessionData.screenshotPath.split(/[/\\]/).pop()}`
              : '',
            analysis,
            patterns: analysis.detected_patterns,
            scores: analysis.scores,
            report: undefined,
            createdAt: sessionData.createdAt || new Date().toISOString(),
          })

          // Generate and render narrative from the fetched results
          const narrative = createNarrativeMessages(analysis)
          narrative.forEach((msg, i) => {
            setTimeout(() => addMessage(msg), i * 800)
          })

          // Set active chips in store (used by useChat to re-append after each response)
          // and add the first chip set inline after the narrative.
          const hasPatterns = (analysis.detected_patterns?.length ?? 0) > 0
          const chips = hasPatterns
            ? [
                'Explain Findings',
                'Show Evidence',
                'Who Is Most Affected?',
                'Suggest Ethical Redesign',
                'Generate Forensic Report',
              ]
            : [
                'Why Was This Considered Safe?',
                'What Did You Check?',
                'Could Anything Have Been Missed?',
                'Compare Against Known Dark Patterns',
                'Generate Forensic Report',
              ]

          setTimeout(() => {
            setActiveChips(chips)
            // Add chips inline after the last narrative message
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              type: 'message',
              content: '',
              metadata: { type: 'action_chips', actions: chips },
              timestamp: new Date().toISOString(),
            })
          }, narrative.length * 800 + 400)

          setTimeout(() => setState('idle'), narrative.length * 800 + 600)
        } catch (err) {
          console.error('[useWebSocket] Failed to fetch session results:', err)
          addMessage({
            id: crypto.randomUUID(), role: 'assistant', type: 'message',
            content: 'Investigation complete. Results saved — type "generate report" to download your forensic PDF.',
            timestamp: new Date().toISOString(),
          })
          setState('idle')
        }
      }
    }

    const handleSessionFailed = (payload: SessionFailedPayload) => {
      setState('idle')
      addEvent(`Analysis failed at stage: ${payload.failedStage}`)
      failSession(payload.failedStage, payload.message)
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: `I encountered an issue during the ${payload.failedStage} stage. ${payload.message}. You can try uploading a new screenshot or submitting a different URL.`,
        timestamp: new Date().toISOString(),
      })
    }

    // ── reconnect_failed (after 3 attempts) ──────────────────────────────────
    const handleReconnectFailed = () => {
      setState('idle')
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: 'Connection to the investigation server was lost. Please refresh the page and try again.',
        timestamp: new Date().toISOString(),
      })
    }

    const handleReconnectAttempt = () => {
      reconnectAttemptsRef.current += 1
    }

    const handleConnect = () => {
      reconnectAttemptsRef.current = 0
    }

    // Register event listeners
    socket.on('session_started', handleSessionStarted)
    socket.on('stage_progress', handleStageProgress)
    socket.on('session_complete', handleSessionComplete)
    socket.on('session_failed', handleSessionFailed)
    socket.on('reconnect_failed', handleReconnectFailed)
    socket.on('reconnect_attempt', handleReconnectAttempt)
    socket.on('connect', handleConnect)

    // Connect on mount
    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      // Only remove listeners — do NOT disconnect the socket.
      // The socket is a singleton; disconnecting on unmount kills in-flight
      // pipelines and means session_complete never arrives after a re-render.
      socket.off('session_started', handleSessionStarted)
      socket.off('stage_progress', handleStageProgress)
      socket.off('session_complete', handleSessionComplete)
      socket.off('session_failed', handleSessionFailed)
      socket.off('reconnect_failed', handleReconnectFailed)
      socket.off('reconnect_attempt', handleReconnectAttempt)
      socket.off('connect', handleConnect)
    }
  }, [setState, addMessage, addEvent])

  return { socket }
}
