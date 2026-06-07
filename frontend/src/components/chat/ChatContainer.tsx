/**
 * ChatContainer.tsx
 *
 * Scroll rules:
 * - Mouse wheel / trackpad always works — no parent intercepts events
 * - Auto-scroll ONLY fires when a new USER message is added (not on AI responses)
 * - When AI is streaming a long response, the view stays at the TOP of that
 *   response so the user can read from the start
 * - "New messages" badge appears when the user is scrolled up and new content arrives
 * - Clicking the badge snaps to bottom
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import ChatMessage from './ChatMessage'
import TypingIndicator from './TypingIndicator'
import { useChatStore } from '../../store/chatStore'

const BOTTOM_THRESHOLD = 80
const NEAR_BOTTOM_THRESHOLD = 120

export default function ChatContainer() {
  const messages  = useChatStore((s) => s.messages)
  const isTyping  = useChatStore((s) => s.isTyping)
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef  = useRef(true)
  const prevCountRef = useRef(messages.length)
  const [showBtn, setShowBtn] = useState(false)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist <= 0) return
    const duration = Math.min(280, dist * 0.4)
    let start: number | null = null
    const from = el.scrollTop
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      el.scrollTop = from + dist * (1 - Math.pow(1 - p, 3))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distFromBottom < BOTTOM_THRESHOLD
    atBottomRef.current = atBottom
    setShowBtn(!atBottom)
  }, [])

  useEffect(() => {
    const prevCount = prevCountRef.current
    const newCount  = messages.length
    prevCountRef.current = newCount

    if (newCount === prevCount) return  // isTyping changed, not message count

    const latest = messages[newCount - 1]
    if (!latest) return

    if (latest.role === 'user') {
      // User just sent a message — always snap to bottom
      atBottomRef.current = true
      requestAnimationFrame(scrollToBottom)
      setShowBtn(false)
      return
    }

    // AI message arrived
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight

    if (distFromBottom < NEAR_BOTTOM_THRESHOLD) {
      // Already near bottom — keep scrolling down naturally
      requestAnimationFrame(scrollToBottom)
      setShowBtn(false)
    } else {
      // User is reading — don't steal their position, show badge instead
      setShowBtn(true)
    }
  }, [messages, scrollToBottom])

  // Don't auto-scroll when only isTyping changes
  useEffect(() => {
    if (!isTyping) return
    if (atBottomRef.current) {
      requestAnimationFrame(scrollToBottom)
    }
  }, [isTyping, scrollToBottom])

  const handleBtnClick = useCallback(() => {
    atBottomRef.current = true
    setShowBtn(false)
    scrollToBottom()
  }, [scrollToBottom])

  return (
    <div style={{
      position: 'relative',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      // Explicit pointer-events to ensure mouse wheel reaches this element
      pointerEvents: 'auto',
    }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          // pointer-events must be auto for mouse wheel to work
          pointerEvents: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,229,255,0.15) transparent',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 20px 16px' }}>
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div style={{ height: 8 }} />
        </div>
      </div>

      <AnimatePresence>
        {showBtn && (
          <motion.button
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            onClick={handleBtnClick}
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 20,
              background: 'rgba(124,58,237,0.92)',
              border: '1px solid rgba(124,58,237,0.6)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              zIndex: 10,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 12px rgba(124,58,237,0.5)',
              pointerEvents: 'auto',
            }}
          >
            <ChevronDown size={13} />
            New messages
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
