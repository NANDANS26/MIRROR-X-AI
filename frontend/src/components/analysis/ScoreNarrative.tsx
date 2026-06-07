/**
 * ScoreNarrative.tsx — Score display in chat.
 *
 * FIX: Backend returns scores as ScoreBreakdown objects {score, contributions}
 * not raw numbers. Extract .score from each field.
 */

import { motion } from 'framer-motion'


interface Props {
  scores?: any
  score?: number
  trust?: number
  fairness?: string
}

const fairnessColor = (fairness: string): string => {
  const f = (fairness || '').toLowerCase()
  if (f.includes('fair')) return 'bg-green-500/20 text-green-300 border-green-500/30'
  if (f.includes('moderate')) return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
  return 'bg-red-500/20 text-red-300 border-red-500/30'
}

/** Extract a numeric score from either a ScoreBreakdown object or a raw number */
function extractScore(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  if (typeof val === 'object' && 'score' in val) {
    const s = Number(val.score)
    return isNaN(s) ? fallback : s
  }
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function ScoreBar({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  const display = Math.round(clamped)
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] text-gray-400 font-medium">{label}</span>
        <span className="text-[11px] text-white font-bold">{display}</span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, delay, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function ScoreNarrative({ scores, score, trust, fairness }: Props) {
  // FIX: Handle both {score: N, contributions: [...]} and raw number formats
  const manipulation = extractScore(scores?.manipulation_score, extractScore(score, 0))
  const trustVal     = extractScore(scores?.trust_score,        extractScore(trust, 0))
  const friction     = extractScore(scores?.friction_score,     0)

  const fairnessVal: string =
    scores?.ux_fairness_index ?? scores?.UX_Fairness_Index ?? fairness ?? 'Unknown'

  const isHighRisk = manipulation > 70

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-3 rounded-xl border border-purple-500/20 bg-[#111827] p-3.5"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-purple-300 uppercase tracking-wider">
          Risk Assessment
        </span>
        {isHighRisk && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full"
          >
            ⚠ HIGH RISK
          </motion.span>
        )}
      </div>

      <ScoreBar label="Manipulation Score" value={manipulation} color="#EF4444" delay={0.1} />
      <ScoreBar label="Trust Score"        value={trustVal}     color="#22C55E" delay={0.2} />
      <ScoreBar label="Friction Score"     value={friction}     color="#F59E0B" delay={0.3} />

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-400">UX Fairness:</span>
        <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${fairnessColor(fairnessVal)}`}>
          {fairnessVal}
        </span>
      </div>
    </motion.div>
  )
}
