import { useRef, useState, useEffect } from 'react'
import { Paperclip, Send, Link } from 'lucide-react'
import gsap from 'gsap'
import { useInvestigation } from '../../hooks/useInvestigation'
import { useChat } from '../../hooks/useChat'
import { routeCommand } from '../../agent/commandRouter'
import { useActionStore } from '../../store/actionStore'
import { useChatStore } from '../../store/chatStore'
import { useInvestigationSessionStore } from '../../store/investigationSessionStore'

const URL_REGEX = /^https?:\/\//i

export default function ChatInput() {
  const [message, setMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendBtnRef = useRef<HTMLButtonElement>(null)

  const { startInvestigation, startUrlAnalysis } = useInvestigation()
  const { sendMessage: sendChatMessage } = useChat()
  const addMessage = useChatStore((state) => state.addMessage)
  const triggerAction = useActionStore((state) => state.triggerAction)

  const isUrl = URL_REGEX.test(message.trim())

  // ── GSAP hover on Send button ────────────────────────────────────────────────
  useEffect(() => {
    const btn = sendBtnRef.current
    if (!btn) return

    const onEnter = () => {
      gsap.to(btn, {
        scale: 1.08,
        boxShadow: '0 0 12px 3px rgba(6,182,212,0.6)',
        duration: 0.2,
        ease: 'power2.out',
      })
    }

    const onLeave = () => {
      gsap.to(btn, {
        scale: 1,
        boxShadow: '0 0 0px 0px rgba(6,182,212,0)',
        duration: 0.2,
        ease: 'power2.in',
      })
    }

    btn.addEventListener('mouseenter', onEnter)
    btn.addEventListener('mouseleave', onLeave)

    return () => {
      btn.removeEventListener('mouseenter', onEnter)
      btn.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  const sendMessage = async () => {
    if (!message.trim() && !selectedFile) return

    const userInput = message.trim()

    // ── URL submission ─────────────────────────────────────────────────────────
    if (isUrl) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        type: 'message',
        content: userInput,
        timestamp: new Date().toISOString(),
      })
      setMessage('')
      await startUrlAnalysis(userInput)
      return
    }

    const action = routeCommand(userInput)

    let preview = ''
    if (selectedFile) {
      preview = URL.createObjectURL(selectedFile)
    }

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      type: 'message',
      content: userInput || 'Uploaded screenshot',
      timestamp: new Date().toISOString(),
      file: selectedFile
        ? { name: selectedFile.name, preview }
        : undefined,
    })

    if (action !== 'UNKNOWN') {
      triggerAction(action)

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: `Executing ${action.replaceAll('_', ' ').toLowerCase()}...`,
        timestamp: new Date().toISOString(),
      })

      setMessage('')
      return
    }

    const uploadedFile = selectedFile
    setMessage('')
    setSelectedFile(null)

    if (uploadedFile) {
      await startInvestigation(uploadedFile)
    } else if (userInput) {
      // Route text follow-up questions to the chat API — use stored sessionId directly
      await sendChatMessage(null, userInput)
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setSelectedFile(file)
          }}
        />

        {/* URL indicator or Paperclip */}
        {isUrl ? (
          <Link size={16} className="text-cyan-400 shrink-0" />
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-500 hover:text-cyan-400 transition-colors"
            title="Upload screenshot"
          >
            <Paperclip size={16} />
          </button>
        )}

        <div className="flex-1 relative">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage()
            }}
            placeholder="Ask anything..."
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: isUrl ? '#67e8f9' : '#E2E8F0' }}
          />
          {isUrl && (
            <div className="absolute bottom-0 left-0 right-0 h-px rounded-full" style={{ background: 'rgba(6,182,212,0.4)' }} />
          )}
        </div>

        {isUrl && (
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              color: '#06B6D4',
              border: '1px solid rgba(6,182,212,0.4)',
              background: 'rgba(6,182,212,0.1)',
            }}
          >
            URL
          </span>
        )}

        {/* Send button — matches reference image (square cyan button) */}
        <button
          ref={sendBtnRef}
          onClick={sendMessage}
          className="flex items-center justify-center rounded-xl shrink-0 transition-all"
          style={{
            width: 38,
            height: 38,
            background: 'linear-gradient(135deg, #0ea5e9, #2563EB)',
            boxShadow: '0 0 16px rgba(6,182,212,0.5)',
          }}
        >
          <Send size={15} className="text-white" />
        </button>
      </div>

      {/* Submit URL / Upload Evidence row */}
      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-[10px] text-gray-600 tracking-wide">Submit URL / Upload Evidence</span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-500 hover:text-cyan-400 transition-colors"
            title="Upload file"
          >
            <Paperclip size={13} />
          </button>
          <button className="text-gray-500 hover:text-cyan-400 transition-colors" title="Submit URL">
            <Link size={13} />
          </button>
        </div>
      </div>

      {selectedFile && (
        <div className="mt-2 text-xs text-cyan-300/70">
          Attached: {selectedFile.name}
        </div>
      )}
    </div>
  )
}
