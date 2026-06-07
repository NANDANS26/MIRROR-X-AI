/**
 * InvestigatorPage.tsx — Cinematic AI Command Center.
 *
 * Replicates the reference image exactly:
 * - Deep space/lab 3D background (R3F)
 * - Center: floating glass workstation with left icon rail + main chat + right unified panel
 * - Bottom center: premium 3D orb with CSS overlay rings
 * - Bottom: command input bar (max-w-3xl, taller)
 * - Right: ONE unified glass panel with 3 sections
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '../store/agentStore'
import { useActivityStore } from '../store/activityStore'
import EvidenceController from '../controllers/EvidenceController'
import VoiceController from '../controllers/VoiceController'
import NeuralBackground from '../background/NeuralBackground'
import ChatContainer from '../components/chat/ChatContainer'
import ChatInput from '../components/chat/ChatInput'
import InvestigationOrb from '../widgets/InvestigationOrb'
import Sidebar from '../components/layout/Sidebar'
import { useWebSocket } from '../hooks/useWebSocket'
import { usePipelineStore } from '../store/pipelineStore'
import {
  Menu, MessageSquare,
  Minus, Square, X, LogOut
} from 'lucide-react'
import type { AgentState } from '../store/agentStore'

const STATE_LABEL: Record<AgentState, string> = {
  idle: 'STANDBY', thinking: 'PROCESSING',
  investigating: 'INVESTIGATING', warning: 'HIGH RISK', explaining: 'EXPLAINING',
}
const STATE_COLOR: Record<AgentState, string> = {
  idle: '#00E5FF', thinking: '#2563EB',
  investigating: '#7C3AED', warning: '#EF4444', explaining: '#10B981',
}

export default function InvestigatorPage() {
  const state = useAgentStore((s) => s.state)
  const events = useActivityStore((s) => s.events)
  const pipeline = usePipelineStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  useWebSocket()

  const color = STATE_COLOR[state]
  const label = STATE_LABEL[state]

  const handleSignOut = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden select-none"
      style={{ background: '#010209', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
    >
      {/* ── 3D Background ─────────────────────────────────────────────── */}
      <NeuralBackground />

      {/* ── Controllers ───────────────────────────────────────────────── */}
      <EvidenceController />
      <VoiceController />

      {/* ── Sidebar Drawer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
              onClick={() => setSidebarOpen(false)} />
            <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="fixed left-0 top-0 h-full z-40" style={{ width: 290 }}>
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CONTENT LAYER
      ════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 h-full flex flex-col">

        {/* ─────────────────────────────────────────────────────────────
            CENTER AREA — the floating workstation row
        ──────────────────────────────────────────────────────────────── */}
        <div
          className="flex-1 flex items-center justify-center"
          style={{ paddingTop: 14, paddingBottom: 200 }}
        >
          <div className="flex items-start gap-3 w-full max-w-6xl px-4" style={{ pointerEvents: 'auto' }}>

            {/* ── Main glass workstation ──────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-row rounded-2xl relative"
              style={{
                height: 'calc(100vh - 210px)',
                minHeight: 380,
                maxHeight: 560,
                background: 'rgba(4, 7, 22, 0.80)',
                border: `1px solid ${color}45`,
                backdropFilter: 'blur(36px)',
                boxShadow: `
                  0 0 0 1px rgba(0,229,255,0.10),
                  0 0 60px ${color}35,
                  0 0 120px rgba(124,58,237,0.22),
                  0 0 200px rgba(124,58,237,0.08),
                  0 32px 80px rgba(0,0,0,0.90),
                  inset 0 1px 0 rgba(255,255,255,0.10),
                  inset 0 0 100px rgba(0,229,255,0.03)
                `,
                overflow: 'hidden',
              }}
            >
              {/* Corner illumination glows */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 80, background: `radial-gradient(circle at 0% 0%, ${color}25 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at 100% 0%, ${color}18 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: 100, height: 50, background: `radial-gradient(ellipse at 0% 100%, rgba(124,58,237,0.15) 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 100, height: 50, background: `radial-gradient(ellipse at 100% 100%, rgba(124,58,237,0.10) 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

              {/* Animated horizontal scan line */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 7, ease: 'linear', repeatDelay: 5 }}
                style={{ position: 'absolute', top: 0, left: 0, width: '35%', height: '1px', background: `linear-gradient(90deg, transparent, ${color}50, transparent)`, pointerEvents: 'none', zIndex: 1 }}
              />

              {/* ── Left icon rail ────────────────────────────────────── */}
              <div style={{
                width: 44,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '50px 6px 10px',
                borderRight: `1px solid ${color}18`,
                background: 'rgba(0,0,0,0.25)',
                flexShrink: 0,
                zIndex: 2,
              }}>
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  className="flex items-center justify-center rounded-lg transition-all"
                  style={{ width: 30, height: 30, background: `${color}28`, border: `1px solid ${color}55`, color: color }}
                  title="Chat"
                >
                  <MessageSquare size={13} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.15 }}
                  className="flex items-center justify-center rounded-lg transition-all"
                  style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)', marginTop: 'auto' }}
                  title="Sign out"
                  onClick={handleSignOut}
                >
                  <LogOut size={13} />
                </motion.button>
              </div>

              {/* ── Main chat column ──────────────────────────────────── */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, zIndex: 2, overflow: 'hidden' }}>
                {/* Workstation title bar */}
                <div
                  className="flex items-center px-4 py-2.5 shrink-0"
                  style={{
                    background: `linear-gradient(90deg, ${color}06, rgba(0,0,0,0), ${color}04)`,
                    borderBottom: `1px solid ${color}22`,
                  }}
                >
                  {/* Traffic light dots */}
                  <div className="flex items-center gap-1.5 mr-4">
                    <div className="w-2.5 h-2.5 rounded-full cursor-pointer hover:brightness-125"
                      style={{ background: '#FF5F57', boxShadow: '0 0 8px #FF5F5790' }} />
                    <div className="w-2.5 h-2.5 rounded-full cursor-pointer hover:brightness-125"
                      style={{ background: '#FFBD2E', boxShadow: '0 0 8px #FFBD2E90' }} />
                    <div className="w-2.5 h-2.5 rounded-full cursor-pointer hover:brightness-125"
                      style={{ background: '#28C840', boxShadow: '0 0 8px #28C84090' }} />
                  </div>

                  {/* Brand */}
                  <button onClick={() => setSidebarOpen(true)} className="mr-3 text-white/20 hover:text-white/50">
                    <Menu size={15} />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black"
                      style={{ background: `linear-gradient(135deg, ${color}, #7C3AED)`, boxShadow: `0 0 12px ${color}70` }}>
                      X
                    </div>
                    <span className="text-xs font-bold tracking-[0.20em] uppercase" style={{ color: '#E2E8F0', letterSpacing: '0.18em' }}>
                      MIRROR X AI
                    </span>
                  </div>

                  {/* Window controls */}
                  <div className="ml-auto flex items-center gap-3">
                    <motion.div
                      animate={{ opacity: [0.65, 1, 0.65] }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                      className="text-[9px] font-black tracking-[0.25em] px-2.5 py-0.5 rounded-full border"
                      style={{ color, borderColor: `${color}55`, background: `${color}18`, boxShadow: `0 0 8px ${color}30` }}
                    >
                      {label}
                    </motion.div>
                    <button className="text-white/20 hover:text-white/50 transition-colors"><Minus size={11} /></button>
                    <button className="text-white/20 hover:text-white/50 transition-colors"><Square size={10} /></button>
                    <button className="text-white/20 hover:text-red-400 transition-colors"><X size={11} /></button>
                  </div>
                </div>

                {/* Chat thread */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <ChatContainer />
                </div>
              </div>
            </motion.div>

            {/* ── Right unified glass panel ─────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              style={{
                width: 212,
                flexShrink: 0,
                background: 'rgba(3, 6, 20, 0.88)',
                border: '1px solid rgba(0,229,255,0.18)',
                backdropFilter: 'blur(28px)',
                borderRadius: 16,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                height: 'calc(100vh - 210px)',
                maxHeight: 560,
                boxShadow: `
                  0 4px 40px rgba(0,0,0,0.7),
                  0 0 0 1px rgba(124,58,237,0.08),
                  inset 0 1px 0 rgba(255,255,255,0.07),
                  inset 0 0 30px rgba(0,229,255,0.02)
                `,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Top edge glow */}
              <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px', background: `linear-gradient(90deg, transparent, ${color}60, transparent)`, pointerEvents: 'none' }} />
              {/* Corner accents */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 16, borderTop: `1px solid ${color}50`, borderLeft: `1px solid ${color}50`, borderTopLeftRadius: 16, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTop: '1px solid rgba(0,229,255,0.45)', borderRight: '1px solid rgba(0,229,255,0.45)', borderTopRightRadius: 16, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: 16, height: 16, borderBottom: '1px solid rgba(124,58,237,0.35)', borderLeft: '1px solid rgba(124,58,237,0.35)', borderBottomLeftRadius: 16, pointerEvents: 'none' }} />

              {/* Section 1: Investigation Status */}
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 10, marginBottom: 10, flexShrink: 0 }}>
                <div className="text-[9px] font-semibold tracking-[0.24em] uppercase mb-2"
                  style={{ color: 'rgba(0,229,255,0.65)' }}>
                  Investigation Status
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <motion.span
                    animate={{ opacity: [0.75, 1, 0.75] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                    className="text-[11px] font-black tracking-widest"
                    style={{ color, textShadow: `0 0 12px ${color}80` }}
                  >
                    {label}
                  </motion.span>
                  <span className="text-[10px] text-white/40 font-mono">{pipeline.currentStep}/{pipeline.totalSteps}</span>
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${color}60, ${color})`, boxShadow: `0 0 8px ${color}90` }}
                    animate={{ width: pipeline.totalSteps > 0 ? `${(pipeline.currentStep / pipeline.totalSteps) * 100}%` : '0%' }}
                    transition={{ duration: 1, ease: 'easeInOut' }}
                  />
                </div>
                <p className="text-[9px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {pipeline.isActive
                    ? pipeline.stages.find(s => s.status === 'active')?.label ?? 'Processing...'
                    : pipeline.completedAt ? 'Completed' : 'Awaiting investigation'}
                </p>
              </div>

              {/* Section 2: Active Activity */}
              <div style={{ flex: 1, overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 10, marginBottom: 10, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div className="text-[9px] font-semibold tracking-[0.24em] uppercase mb-2"
                  style={{ color: 'rgba(0,229,255,0.65)', flexShrink: 0 }}>
                  Active Activity
                </div>
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
                  className="flex flex-col gap-1 scrollbar-hide">
                  {events.length === 0 ? (
                    <>
                      {[
                        'Forensic Engine Ready',
                        'Behavior Analysis Models Loaded',
                        'Awaiting Evidence',
                      ].map((msg, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: color, opacity: 0.7 }} />
                          <span className="text-[9px] leading-tight" style={{ color: 'rgba(255,255,255,0.55)' }}>{msg}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    events.slice(0, 8).map((e) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-1.5"
                      >
                        <div className="w-1 h-1 rounded-full mt-1.5 shrink-0 animate-pulse" style={{ background: color }} />
                        <span className="text-[9px] leading-tight" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {e.message}
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Section 3: Pipeline Progress */}
              <div style={{ flexShrink: 0 }}>
                <div className="text-[9px] font-semibold tracking-[0.24em] uppercase mb-2"
                  style={{ color: 'rgba(0,229,255,0.65)' }}>
                  Pipeline Progress
                </div>
                <div className="flex flex-col gap-1">
                  {pipeline.stages.length === 0 ? (
                    // Default stages when pipeline not yet active
                    ['01 Capture', '02 Rule Engine', '03 AI Analysis', '04 Simulation', '05 Scoring'].map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                        <span className="text-[9px] leading-none" style={{ color: 'rgba(255,255,255,0.2)' }}>{s}</span>
                      </div>
                    ))
                  ) : (
                    pipeline.stages.map((stage) => {
                      const isDone   = stage.status === 'completed'
                      const isActive = stage.status === 'active'
                      const isFailed = stage.status === 'failed'
                      const stageColor = isFailed ? '#EF4444' : isDone ? color : isActive ? color : 'rgba(255,255,255,0.18)'
                      return (
                        <div key={stage.stage} className="flex items-center gap-2">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor, boxShadow: isActive ? `0 0 7px ${color}` : 'none', flexShrink: 0 }} />
                          <span className="text-[9px] leading-none" style={{ color: isDone || isActive ? 'rgba(255,255,255,0.75)' : isFailed ? '#EF4444' : 'rgba(255,255,255,0.2)' }}>
                            {String(stage.stepNumber).padStart(2, '0')} {stage.label}
                          </span>
                          {isDone && <span style={{ marginLeft: 'auto', fontSize: 8, color }}>✓</span>}
                          {isFailed && <span style={{ marginLeft: 'auto', fontSize: 8, color: '#EF4444' }}>✗</span>}
                          {isActive && (
                            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2 }}
                              style={{ marginLeft: 'auto', fontSize: 8, color }}>●</motion.span>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* ── Bottom: Orb + Command Bar ─────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 flex flex-col items-center" style={{ paddingBottom: 14, pointerEvents: 'none' }}>

        {/* ── Orb overlay section ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'relative',
            marginBottom: -10,
            zIndex: 25,
          }}
        >
          <InvestigationOrb state={state} />
        </motion.div>

        {/* Command Input */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="w-full max-w-3xl px-4"
          style={{ zIndex: 20, pointerEvents: 'auto' }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(3, 6, 18, 0.94)',
              border: `1.5px solid ${color}55`,
              backdropFilter: 'blur(28px)',
              boxShadow: `
                0 0 0 1px rgba(0,229,255,0.07),
                0 0 28px ${color}30,
                0 0 55px ${color}15,
                0 0 80px rgba(124,58,237,0.12),
                0 8px 48px rgba(0,0,0,0.85),
                inset 0 1px 0 rgba(255,255,255,0.08)
              `,
              minHeight: 66,
            }}
          >
            <ChatInput />
          </div>
        </motion.div>
      </div>

      {/* ── Ambient sparkle (bottom-right corner detail) ─────────────── */}
      <div className="fixed bottom-5 right-5 z-10">
        <motion.div
          animate={{ rotate: [0, 180, 360], scale: [0.9, 1.3, 0.9], opacity: [0.3, 0.8, 0.3] }}
          transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
          style={{ color: '#00E5FF', fontSize: 20, textShadow: '0 0 14px #00E5FF, 0 0 28px #00E5FF50' }}
        >
          ✦
        </motion.div>
      </div>

      {/* ── Top-left subtle corner decoration ────────────────────────── */}
      <div className="fixed top-3 left-3 z-10 opacity-30">
        <motion.div
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 2 }}
          style={{ color: '#7C3AED', fontSize: 14, textShadow: '0 0 10px #7C3AED' }}
        >
          ✦
        </motion.div>
      </div>
    </div>
  )
}