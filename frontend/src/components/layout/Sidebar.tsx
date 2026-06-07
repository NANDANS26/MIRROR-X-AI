/**
 * Sidebar.tsx — Investigation history panel.
 *
 * Fixes:
 * - Token key matches 'token' used everywhere in the auth flow
 * - setLoading(false) always called — never hangs on spinner
 * - History fetch error silently handled, loader always resolved
 *
 * Style: cinematic glass panel — feels part of the MIRROR X AI system
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Globe, ImageIcon, Loader2, Clock, LogOut, ChevronRight, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useChatStore } from '../../store/chatStore'
import { useInvestigationSessionStore } from '../../store/investigationSessionStore'
import { useAgentStore } from '../../store/agentStore'
import { createNarrativeMessages } from '../../services/investigationNarrator'

interface HistoryItem {
  sessionId: string
  sourceType: 'url' | 'upload' | string
  sourceLabel: string
  createdAt: string
  uxFairnessIndex?: string
}

const fairnessMeta = (f?: string): { label: string; color: string; dot: string } => {
  const v = (f || '').toLowerCase()
  if (v.includes('fair'))     return { label: f!, color: 'rgba(34,197,94,0.15)',  dot: '#22c55e' }
  if (v.includes('moderate')) return { label: f!, color: 'rgba(249,115,22,0.15)', dot: '#f97316' }
  if (f)                      return { label: f,  color: 'rgba(239,68,68,0.15)',  dot: '#ef4444' }
  return { label: 'Unknown', color: 'rgba(100,100,120,0.15)', dot: '#6b7280' }
}

function truncate(str: string | undefined, n: number) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

const relativeTime = (dateStr: string): string => {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}d ago`
    return `${Math.floor(d / 30)}mo ago`
  } catch { return dateStr }
}

export default function Sidebar() {
  const [history,        setHistory]        = useState<HistoryItem[]>([])
  const [loading,        setLoading]        = useState(false)
  const [loadingSession, setLoadingSession] = useState<string | null>(null)
  const [activeId,       setActiveId]       = useState<string | null>(null)

  const navigate      = useNavigate()
  const clearChat     = useChatStore((s) => s.clearChat)
  const addMessage    = useChatStore((s) => s.addMessage)
  const setSession    = useInvestigationSessionStore((s) => s.setSession)
  const clearSession  = useInvestigationSessionStore((s) => s.clearSession)
  const setState      = useAgentStore((s) => s.setState)

  // ── Auth token — must match the key used in LoginPage / RegisterPage ──────
  const token = localStorage.getItem('token')

  useEffect(() => {
    // No token → don't hang, just skip
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .get('/analysis/history')
      .then((res) => {
        const items: HistoryItem[] = (res.data?.sessions || res.data || []).slice(0, 100)
        setHistory(items)
      })
      .catch(() => {
        // Auth failure, network error, etc. — always resolve the loader
        setLoading(false)
      })
      .finally(() => {
        // .finally fires after .then AND .catch, so this always runs
        setLoading(false)
      })
  }, [token])

  const handleSelect = async (item: HistoryItem) => {
    setLoadingSession(item.sessionId)
    setActiveId(item.sessionId)
    try {
      const res = await api.get(`/analysis/${item.sessionId}`)
      const data = res.data
      setSession({
        image:    data.image_url || data.screenshot_url || '',
        analysis: data.analysis || data,
        patterns: data.analysis?.detected_patterns || data.detected_patterns || [],
        scores:   data.analysis?.scores || data.scores,
        report:   data.analysis?.ai_analysis || data.ai_analysis,
        createdAt: item.createdAt,
      })
      clearChat()
      const narrative = createNarrativeMessages(data.analysis || data)
      narrative.slice(-10).forEach((msg, i) => {
        setTimeout(() => addMessage(msg), i * 50)
      })
      setState('explaining')
      setTimeout(() => setState('idle'), narrative.slice(-10).length * 50 + 500)
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: 'Failed to load investigation session. Please try again.',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoadingSession(null)
    }
  }

  const handleNew = () => {
    clearChat()
    clearSession()
    setState('idle')
    setActiveId(null)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(3,5,18,0.96)',
        borderRight: '1px solid rgba(0,229,255,0.12)',
        backdropFilter: 'blur(32px)',
        pointerEvents: 'auto',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.5), transparent)' }} />

      {/* Header */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #00E5FF, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 900, color: '#fff',
            boxShadow: '0 0 14px rgba(0,229,255,0.4)',
          }}>X</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: '#e2e8f0' }}>MIRROR X AI</div>
            <div style={{ fontSize: 9, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.2em' }}>FORENSIC SYSTEM</div>
          </div>
        </div>

        {/* New investigation button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNew}
          style={{
            width: '100%',
            padding: '9px 14px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: '#00E5FF',
            background: 'rgba(0,229,255,0.08)',
            border: '1px solid rgba(0,229,255,0.28)',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            boxShadow: '0 0 12px rgba(0,229,255,0.08)',
            transition: 'all 0.2s',
          }}
        >
          <Plus size={14} />
          New Investigation
        </motion.button>
      </div>

      {/* Section label */}
      <div style={{ padding: '12px 16px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(0,229,255,0.55)', textTransform: 'uppercase' }}>
          <Clock size={10} />
          Investigation History
        </div>
      </div>

      {/* History list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 12px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,229,255,0.12) transparent', minHeight: 0 }}>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 0', color: 'rgba(0,229,255,0.5)', fontSize: 11 }}>
            <Loader2 size={14} className="animate-spin" />
            Loading...
          </div>
        )}

        {!loading && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
            <Zap size={20} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
            No investigations yet.<br />
            Upload a screenshot or share a URL to begin.
          </div>
        )}

        <AnimatePresence>
          {history.map((item, i) => {
            const fm = fairnessMeta(item.uxFairnessIndex)
            const isActive  = activeId === item.sessionId
            const isLoading = loadingSession === item.sessionId
            return (
              <motion.button
                key={item.sessionId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                onClick={() => handleSelect(item)}
                disabled={isLoading}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 10px',
                  marginBottom: 4,
                  borderRadius: 10,
                  background: isActive ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? 'rgba(0,229,255,0.25)' : 'rgba(255,255,255,0.05)'}`,
                  cursor: isLoading ? 'wait' : 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.borderColor = 'rgba(0,229,255,0.15)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
                  }
                }}
              >
                {/* Icon */}
                <div style={{ marginTop: 1, color: isActive ? '#00E5FF' : 'rgba(255,255,255,0.3)', flexShrink: 0, transition: 'color 0.15s' }}>
                  {item.sourceType === 'url' ? <Globe size={12} /> : <ImageIcon size={12} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: isActive ? '#e2e8f0' : 'rgba(255,255,255,0.7)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {truncate(item.sourceLabel || item.sessionId, 36)}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                    {relativeTime(item.createdAt)}
                  </div>
                  {item.uxFairnessIndex && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: fm.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: fm.dot, fontWeight: 600 }}>{item.uxFairnessIndex}</span>
                    </div>
                  )}
                </div>

                {/* Right side */}
                <div style={{ flexShrink: 0, marginTop: 1 }}>
                  {isLoading
                    ? <Loader2 size={11} className="animate-spin" style={{ color: '#00E5FF' }} />
                    : isActive
                      ? <ChevronRight size={11} style={{ color: '#00E5FF' }} />
                      : null
                  }
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Footer — logout */}
      <div style={{ padding: '10px 14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#ef4444'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
            e.currentTarget.style.background = 'rgba(239,68,68,0.06)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <LogOut size={13} />
          Sign out
        </motion.button>
      </div>
    </div>
  )
}
