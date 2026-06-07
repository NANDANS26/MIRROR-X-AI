/**
 * LoginPage.tsx — Neural synthesis / operator authentication scene.
 *
 * Background: Same violet/cyan hex lattice, data nodes, binary streams,
 * and emergence rings as RegisterPage — cohesive visual identity.
 * Card content: login form (email + password + submit).
 *
 * Validates: Requirements 9.1–9.7
 */

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../services/api'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Warm up both Render services as soon as the login page loads
// so they aren't cold-starting when the user actually needs them
function useWarmup() {
  useEffect(() => {
    const ping = async () => {
      try {
        await Promise.allSettled([
          fetch('https://mirror-x-ai-backend.onrender.com/api/health', { method: 'GET' }),
          fetch('https://mirror-x-ai-ai.onrender.com/', { method: 'GET' }),
        ])
      } catch { /* silently ignore */ }
    }
    ping()
  }, [])
}

// ---------------------------------------------------------------------------
// Background — identical to RegisterBackground (violet/cyan hex + nodes)
// ---------------------------------------------------------------------------

function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Data nodes
    const nodes = Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      size: Math.random() * 2.5 + 0.8,
      pulse: Math.random() * Math.PI * 2,
      cyan: Math.random() > 0.5,
    }))

    // Binary stream columns
    const cols = Math.floor(window.innerWidth / 22)
    const streams = Array.from({ length: cols }, (_, i) => ({
      x: i * 22 + 11,
      y: Math.random() * window.innerHeight,
      speed: 0.6 + Math.random() * 1.2,
      chars: '01アイウエオABCXYZ∑∞≈',
      alpha: 0.03 + Math.random() * 0.05,
    }))

    const draw = () => {
      t += 0.007
      const W = canvas.width
      const H = canvas.height

      ctx.fillStyle = '#020010'
      ctx.fillRect(0, 0, W, H)

      // Hex grid
      ctx.strokeStyle = 'rgba(100, 40, 200, 0.07)'
      ctx.lineWidth = 0.5
      const hex = 56
      for (let row = 0; row * hex * 0.75 < H + hex; row++) {
        for (let col = 0; col * hex < W + hex; col++) {
          const ox = col * hex + (row % 2 === 0 ? 0 : hex / 2)
          const oy = row * hex * 0.75
          ctx.beginPath()
          for (let k = 0; k < 6; k++) {
            const angle = (Math.PI / 3) * k - Math.PI / 6
            const px = ox + (hex / 2 - 2) * Math.cos(angle)
            const py = oy + (hex / 2 - 2) * Math.sin(angle)
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.stroke()
        }
      }

      // Binary streams
      ctx.font = '11px monospace'
      streams.forEach((s) => {
        s.y = (s.y + s.speed) % H
        const char = s.chars[Math.floor(Math.random() * s.chars.length)]
        ctx.fillStyle = `rgba(140, 80, 255, ${s.alpha})`
        ctx.fillText(char, s.x, s.y)
        ctx.fillStyle = `rgba(180, 120, 255, ${s.alpha * 3})`
        ctx.fillText(char, s.x, s.y - 12)
      })

      // Node connections
      ctx.lineWidth = 0.4
      nodes.forEach((a, i) => {
        nodes.slice(i + 1).forEach((b) => {
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 160) {
            const alpha = (1 - dist / 160) * 0.18
            ctx.strokeStyle = `rgba(120,60,220,${alpha})`
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        })
      })

      // Nodes
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy
        if (n.x < 0) n.x = W; if (n.x > W) n.x = 0
        if (n.y < 0) n.y = H; if (n.y > H) n.y = 0
        n.pulse += 0.04
        const glow = Math.sin(n.pulse) * 0.4 + 0.6
        const col = n.cyan ? `rgba(0,220,255,${glow * 0.8})` : `rgba(160,80,255,${glow * 0.8})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2)
        ctx.fillStyle = col
        ctx.fill()
        if (Math.sin(n.pulse) > 0.8) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.size * 4, 0, Math.PI * 2)
          ctx.strokeStyle = col.replace('0.8', '0.15')
          ctx.lineWidth = 0.8
          ctx.stroke()
        }
      })

      // Emergence rings from bottom-center
      for (let r = 0; r < 4; r++) {
        const phase = ((t * 0.8 + r * 1.57) % 5)
        const radius = phase * 100 + 20
        const alpha = Math.max(0, 0.25 - phase * 0.05)
        ctx.beginPath()
        ctx.arc(W / 2, H, radius, Math.PI, 0)
        ctx.strokeStyle = `rgba(100,40,255,${alpha})`
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      // Vignette
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.8)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
    />
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Warm up backend + AI service on page load to reduce cold start delays
  useWarmup()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL_REGEX.test(email)) { setError('Please enter a valid email address.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', res.data.token)
      navigate('/chat')
    } catch (err: any) {
      setError(
        err.response?.status === 429
          ? 'Too many attempts. Try again in 15 minutes.'
          : 'Invalid credentials.'
      )
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    background: 'rgba(4, 0, 20, 0.88)',
    border: '1px solid rgba(120,60,220,0.25)',
    color: '#e0d0ff',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#020010' }}>
      <LoginBackground />

      {/* Corner crystal accents */}
      {[
        { style: { top: 20, left: 20 },   bt: true, bl: true },
        { style: { top: 20, right: 20 },  bt: true, br: true },
        { style: { bottom: 20, left: 20 }, bb: true, bl: true },
        { style: { bottom: 20, right: 20 }, bb: true, br: true },
      ].map((c, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.6 }}
          style={{
            position: 'absolute', ...c.style, width: 22, height: 22, zIndex: 2,
            borderTop:    c.bt ? '2px solid rgba(120,60,255,0.65)' : undefined,
            borderBottom: (c as any).bb ? '2px solid rgba(120,60,255,0.65)' : undefined,
            borderLeft:   c.bl ? '2px solid rgba(120,60,255,0.65)' : undefined,
            borderRight:  c.br ? '2px solid rgba(120,60,255,0.65)' : undefined,
          }}
        />
      ))}

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, margin: '0 16px' }}
      >
        <div style={{
          borderRadius: 16,
          padding: '36px 32px',
          background: 'rgba(6, 2, 22, 0.93)',
          border: '1px solid rgba(120,60,220,0.35)',
          boxShadow: '0 0 40px rgba(100,40,220,0.12), 0 0 80px rgba(0,180,255,0.04), inset 0 1px 0 rgba(140,80,255,0.1)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
        }}>
          {/* Top accent line */}
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(100,40,255,0.8), rgba(0,200,255,0.4), transparent)' }} />

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.16em', background: 'linear-gradient(135deg, #a040ff 0%, #00c8ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>
              MIRROR X AI
            </h1>
            <p style={{ fontSize: 11, color: 'rgba(160,100,255,0.75)', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              Operator Authentication
            </p>
          </div>

          {/* Animated status lines */}
          <div style={{ marginBottom: 26, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {['Identity verification', 'Access validation', 'Session provisioning'].map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.5 }}
                  style={{ width: 4, height: 4, borderRadius: '50%', background: i === 0 ? '#00c8ff' : i === 1 ? '#a040ff' : '#7040ff', flexShrink: 0 }}
                />
                <div style={{ flex: 1, height: 1, background: `rgba(${i === 0 ? '0,200,255' : '120,40,255'},0.15)` }}>
                  <motion.div
                    animate={{ width: ['0%', '100%', '0%'] }}
                    transition={{ repeat: Infinity, duration: 2.8 + i, delay: i * 0.7 }}
                    style={{ height: '100%', background: i === 0 ? 'rgba(0,200,255,0.5)' : 'rgba(120,40,255,0.5)' }}
                  />
                </div>
                <span style={{ fontSize: 9, color: 'rgba(140,100,220,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', minWidth: 100 }}>{label}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { id: 'login-email',    label: 'Operator ID (Email)', type: 'email',    value: email,    onChange: setEmail,    auto: 'email' },
              { id: 'login-password', label: 'Access Key',          type: 'password', value: password, onChange: setPassword, auto: 'current-password' },
            ].map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
              >
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(160,100,240,0.7)', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 7 }}>
                  {f.label}
                </label>
                <input
                  id={f.id} type={f.type} value={f.value}
                  onChange={e => f.onChange(e.target.value)}
                  required autoComplete={f.auto}
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(120,60,255,0.65)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(120,60,220,0.25)'}
                />
              </motion.div>
            ))}

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ padding: '10px 12px', background: 'rgba(120,40,255,0.1)', border: '1px solid rgba(120,40,255,0.3)', borderRadius: 6, fontSize: 12, color: '#c080ff', textAlign: 'center' }}
                >
                  ⚠ {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit" disabled={loading}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              whileHover={!loading ? { scale: 1.02 } : undefined}
              whileTap={!loading ? { scale: 0.98 } : undefined}
              style={{
                marginTop: 4,
                padding: '13px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: loading ? 'rgba(100,40,220,0.06)' : 'linear-gradient(135deg, rgba(100,40,220,0.18), rgba(0,160,255,0.12))',
                border: `1px solid ${loading ? 'rgba(100,40,220,0.2)' : 'rgba(100,40,220,0.55)'}`,
                color: loading ? 'rgba(140,80,255,0.4)' : '#a060ff',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 0 20px rgba(100,40,255,0.12)',
              }}
            >
              {loading ? 'Authenticating...' : 'Initiate Access'}
            </motion.button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: 'rgba(160,120,220,0.55)' }}>
            No account?{' '}
            <button
              onClick={() => navigate('/register')}
              style={{ color: 'rgba(140,80,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}
            >
              Register operator
            </button>
          </p>
        </div>
      </motion.div>

      {/* Cold start notice — Render free tier spins down after 15 min of inactivity */}
      <div style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 14px',
        borderRadius: 20,
        background: 'rgba(6,2,22,0.85)',
        border: '1px solid rgba(120,60,220,0.25)',
        backdropFilter: 'blur(12px)',
        maxWidth: 420,
      }}>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#a040ff', flexShrink: 0 }}
        />
        <span style={{ fontSize: 10, color: 'rgba(160,100,240,0.7)', textAlign: 'center' }}>
          Waking up AI services — first analysis may take 30–60s on free tier
        </span>
      </div>
    </div>
  )
}
