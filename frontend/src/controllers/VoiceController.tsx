/**
 * VoiceController.tsx — Reads new assistant messages and speaks them
 * through the browser's SpeechSynthesis API.
 *
 * Behaviour:
 *  - When isMuted is false: speaks every new assistant message of type "message"
 *  - When isMuted is true:  does nothing; any in-progress speech is already
 *    stopped by voiceStore.toggleMute()
 *  - On mount (unmuted only): plays a welcome message after 1 second
 */

import { useEffect, useRef } from 'react'
import { useChatStore } from '../store/chatStore'
import { useVoiceStore } from '../store/voiceStore'
import { voiceService } from '../services/voiceService'

export default function VoiceController() {
  const messages  = useChatStore((s) => s.messages)
  const isMuted   = useVoiceStore((s) => s.isMuted)
  const hasWelcomed = useRef(false)

  // Speak new assistant messages when unmuted
  useEffect(() => {
    if (isMuted) return

    const latest = messages[messages.length - 1]
    if (!latest) return
    if (latest.role !== 'assistant') return
    if (latest.type !== 'message') return
    if (!latest.content?.trim()) return

    voiceService.speak(latest.content)
  }, [messages, isMuted])

  // Stop speech immediately when muted mid-sentence
  useEffect(() => {
    if (isMuted) {
      voiceService.stop()
    }
  }, [isMuted])

  // Welcome message on first load (only if unmuted)
  useEffect(() => {
    if (hasWelcomed.current) return
    if (isMuted) return
    hasWelcomed.current = true
    setTimeout(() => {
      voiceService.speak(
        'Mirror X online. Forensic systems operational. Upload evidence to begin investigation.'
      )
    }, 1000)
  }, [isMuted])

  return null
}
