/**
 * useInvestigation.ts
 *
 * FIX 1: startUrlAnalysis now stores sessionId immediately.
 * FIX 2: startInvestigation stores sessionId from upload response.
 * Both flows explicitly store sessionId so report/chat work after pipeline completion.
 */

import axios from 'axios'
import { useChatStore } from '../store/chatStore'
import { useAgentStore } from '../store/agentStore'
import { useInvestigationSessionStore } from '../store/investigationSessionStore'
import api from '../services/api'
import socket from '../services/socket'

export const useInvestigation = () => {
  const addMessage = useChatStore((state) => state.addMessage)
  const setTyping  = useChatStore((state) => state.setTyping)
  const setState   = useAgentStore((state) => state.setState)
  const setSession = useInvestigationSessionStore((state) => state.setSession)
  const setSessionId = useInvestigationSessionStore((state) => state.setSessionId)

  // ── startInvestigation (file upload) ────────────────────────────────────────
  const startInvestigation = async (file: File) => {
    const token = localStorage.getItem('token')
    if (!token) {
      addMessage({ id: crypto.randomUUID(), role: 'assistant', type: 'message',
        content: 'Authentication required.', timestamp: new Date().toISOString() })
      return
    }

    try {
      setTyping(true)
      setState('investigating')
      addMessage({ id: crypto.randomUUID(), role: 'assistant', type: 'status',
        content: 'Evidence received. Beginning interface reconstruction...', timestamp: new Date().toISOString() })

      // CRITICAL: Connect socket BEFORE sending upload so socket.id is available
      // and the backend can emit session_complete back to this exact tab.
      if (!socket.connected) {
        socket.connect()
        // Wait up to 3 seconds for the connection
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000)
          socket.once('connect', () => { clearTimeout(timeout); resolve() })
        })
      }

      const formData = new FormData()
      formData.append('file', file)
      // Pass socketId in the form body — backend reads req.body.socketId
      if (socket.id) formData.append('socketId', socket.id)

      const response = await api.post('/analysis/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const result = response.data
      const sessionId: string = result.sessionId || result.session_id || ''

      // Store sessionId immediately — critical for report/chat
      if (sessionId) {
        setSessionId(sessionId)
        // Init session shell so report/chat don't get null session
        setSession({
          image: URL.createObjectURL(file),
          analysis: { session_id: sessionId },
          patterns: [],
          scores: undefined,
          report: undefined,
          createdAt: new Date().toISOString(),
        })
      }

      // Join session room so we receive session_complete for this sessionId
      if (sessionId) socket.emit('join_session', sessionId)

      // The upload pipeline is always async — results come via session_complete WebSocket event.
      // (The backend returns 202 Accepted immediately and runs the pipeline in the background.)
      addMessage({ id: crypto.randomUUID(), role: 'assistant', type: 'status',
        content: 'Upload received. Pipeline running — I\'ll report findings as each stage completes...',
        timestamp: new Date().toISOString() })

      setTyping(false)
      return result
    } catch (error) {
      setTyping(false)
      setState('idle')
      addMessage({ id: crypto.randomUUID(), role: 'assistant', type: 'message',
        content: 'The upload could not be processed. Please try again with a different image.',
        timestamp: new Date().toISOString() })
    }
  }

  // ── startUrlAnalysis ─────────────────────────────────────────────────────────
  const startUrlAnalysis = async (url: string) => {
    const token = localStorage.getItem('token')
    if (!token) {
      addMessage({ id: crypto.randomUUID(), role: 'assistant', type: 'message',
        content: 'Authentication required.', timestamp: new Date().toISOString() })
      return
    }

    try {
      setTyping(true)
      setState('investigating')
      addMessage({ id: crypto.randomUUID(), role: 'assistant', type: 'status',
        content: `URL received. Fetching and analyzing: ${url}`, timestamp: new Date().toISOString() })

      // Connect socket BEFORE sending so socket.id is available
      if (!socket.connected) {
        socket.connect()
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000)
          socket.once('connect', () => { clearTimeout(timeout); resolve() })
        })
      }

      const response = await api.post('/analysis/url', { url, socketId: socket.id }, {
        timeout: 90000, // Puppeteer scraping can take up to 60s on slow sites
      })
      const { sessionId } = response.data

      // FIX: Store sessionId immediately — the pipeline is async, but we need
      // sessionId available NOW for when session_complete fires
      if (sessionId) {
        setSessionId(sessionId)
        // Also init session shell so report/chat don't get null session
        setSession({
          image: '',
          analysis: { session_id: sessionId },
          patterns: [],
          scores: undefined,
          report: undefined,
          createdAt: new Date().toISOString(),
        })
      }

      // Join session room so we receive session_complete for this sessionId
      if (!socket.connected) socket.connect()
      if (sessionId) socket.emit('join_session', sessionId)

      addMessage({ id: crypto.randomUUID(), role: 'assistant', type: 'status',
        content: 'URL analysis pipeline running. I will update you as each stage completes...',
        timestamp: new Date().toISOString() })

      setTyping(false)
      return { sessionId }
    } catch (error) {
      setTyping(false)

      // Discriminate between different failure modes — never show a generic
      // "failed" message when the investigation may actually be running.
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const code = error.code

        if (code === 'ECONNABORTED' || code === 'ERR_NETWORK') {
          // Timeout or network drop — the backend may have received the request
          // and started the scraper. Don't mark it as failed.
          setState('investigating') // keep state as investigating
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            type: 'status',
            content: 'The URL is taking longer to load than expected. The investigation is still running — results will appear when the pipeline completes.',
            timestamp: new Date().toISOString(),
          })
          return
        }

        if (status === 400) {
          setState('idle')
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            type: 'message',
            content: 'That URL doesn\'t appear to be valid. Please check the format (e.g. https://example.com) and try again.',
            timestamp: new Date().toISOString(),
          })
          return
        }

        if (status === 504 || status === 422) {
          // Scraper timeout or partial render — backend couldn't load the page
          setState('idle')
          const detail = error.response?.data?.message || 'The page could not be loaded in time.'
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            type: 'message',
            content: `This page was too slow to load for analysis. ${detail} Try a different URL, or upload a screenshot instead.`,
            timestamp: new Date().toISOString(),
          })
          return
        }

        if (status === 502) {
          setState('idle')
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            type: 'message',
            content: 'The scraper could not access that URL. The site may be blocking automated access, or the URL may be behind a login. Try uploading a screenshot instead.',
            timestamp: new Date().toISOString(),
          })
          return
        }
      }

      // Genuine unknown failure
      setState('idle')
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: 'Something went wrong starting the URL analysis. Please try again, or upload a screenshot if the problem persists.',
        timestamp: new Date().toISOString(),
      })
    }
  }

  return { startInvestigation, startUrlAnalysis }
}
