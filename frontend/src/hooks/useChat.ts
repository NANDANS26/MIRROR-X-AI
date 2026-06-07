/**
 * useChat.ts — Chat hook with structured Gemini error handling.
 *
 * The backend always returns HTTP 200.
 * On Gemini failure, the response contains:
 *   { success: false, error_type: "authentication|quota|...", response: "<fallback>" }
 *
 * The fallback text is the AI-generated graceful degradation message.
 * We display it directly — it's already human-readable and specific.
 */

import axios from 'axios'
import api from '../services/api'
import { useChatStore } from '../store/chatStore'
import { useAgentStore } from '../store/agentStore'
import { useInvestigationSessionStore } from '../store/investigationSessionStore'

export const useChat = () => {
  const messages    = useChatStore((s) => s.messages)
  const addMessage  = useChatStore((s) => s.addMessage)
  const setTyping   = useChatStore((s) => s.setTyping)
  const activeChips = useChatStore((s) => s.activeChips)
  const setState    = useAgentStore((s) => s.setState)
  const storedSessionId = useInvestigationSessionStore((s) => s.sessionId)

  const sendMessage = async (
    sessionIdArg: string | null | undefined,
    message: string
  ): Promise<void> => {
    const sessionId = sessionIdArg || storedSessionId

    if (!sessionId) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: 'No active investigation session. Please upload a screenshot or submit a URL first.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    setState('thinking')
    setTyping(true)

    try {
      const response = await api.post(`/chat/${sessionId}`, { message, history })
      const data = response.data

      // The response field is always present — it's either the AI reply or
      // a specific fallback message explaining why AI is unavailable.
      const assistantReply: string =
        data?.response ||
        data?.fallback_message ||
        data?.reply ||
        'I could not generate a response. Please try again.'

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: assistantReply,
        timestamp: new Date().toISOString(),
      })

      // Re-append chips after every response (success or graceful fallback)
      if (activeChips.length > 0) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: '',
          metadata: { type: 'action_chips', actions: activeChips },
          timestamp: new Date().toISOString(),
        })
      }
    } catch (err) {
      // This path is only reached if the backend itself is unreachable
      // (not the AI service — the backend wraps those into 200 responses).
      let errorMessage =
        'The investigation service is unreachable. Please check your connection and try again.'

      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        if (status === 401 || status === 403) {
          errorMessage = 'Authentication expired. Please log in again.'
        } else if (status === 404) {
          errorMessage = 'Investigation session not found. Please start a new investigation.'
        } else if (status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.'
        } else if (status && status >= 500) {
          errorMessage =
            'The backend service encountered an error. ' +
            'Your investigation results are still available — only chat is affected.'
        }
      }

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: errorMessage,
        timestamp: new Date().toISOString(),
      })

      // Still re-append chips even on error — user should be able to retry
      if (activeChips.length > 0) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: '',
          metadata: { type: 'action_chips', actions: activeChips },
          timestamp: new Date().toISOString(),
        })
      }
    } finally {
      setState('idle')
      setTyping(false)
    }
  }

  return { sendMessage }
}
