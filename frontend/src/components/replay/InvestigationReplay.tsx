import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { DetectedPattern } from '../../types/analysis'

export interface InvestigationReplayProps {
  patterns: DetectedPattern[]
  screenshotUrl: string
  isActive: boolean
  onClose: () => void
  onStepChange?: (step: number) => void
}

const CONFIDENCE_COLORS: Record<DetectedPattern['confidence_level'], string> = {
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#EAB308',
}

// Sort patterns: bbox by y then x; no-bbox patterns go last
function sortPatterns(patterns: DetectedPattern[]): DetectedPattern[] {
  return [...patterns].sort((a, b) => {
    const aHas = !!a.bounding_box
    const bHas = !!b.bounding_box
    if (!aHas && !bHas) return 0
    if (!aHas) return 1
    if (!bHas) return -1
    const yDiff = (a.bounding_box!.y) - (b.bounding_box!.y)
    return yDiff !== 0 ? yDiff : (a.bounding_box!.x) - (b.bounding_box!.x)
  })
}

export default function InvestigationReplay({
  patterns,
  screenshotUrl,
  isActive,
  onClose,
  onStepChange,
}: InvestigationReplayProps) {
  const sorted = sortPatterns(patterns)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = sorted.length

  // Auto-advance timer
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setStep((prev) => {
        const next = prev + 1
        if (next >= total) {
          setPlaying(false)
          return prev
        }
        return next
      })
    }, 2500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [playing, total])

  useEffect(() => {
    onStepChange?.(step)
  }, [step, onStepChange])

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImgSize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      })
    }
  }

  if (!isActive) return null

  if (total < 2) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-[#111827] rounded-2xl p-8 text-center max-w-sm border border-white/10">
          <div className="text-yellow-400 text-2xl mb-3">⚠</div>
          <p className="text-gray-300">Insufficient patterns for replay</p>
          <p className="text-sm text-gray-500 mt-2">At least 2 detected patterns are required.</p>
          <button
            onClick={onClose}
            className="mt-6 px-4 py-2 bg-purple-600 rounded-xl text-white text-sm hover:bg-purple-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const current = sorted[step]
  const bb = current.bounding_box
  const color = CONFIDENCE_COLORS[current.confidence_level]

  // Scale bounding box from natural to rendered size
  const scaleX = imgRef.current && imgSize.width > 0
    ? imgRef.current.clientWidth / (imgRef.current.naturalWidth || imgSize.width)
    : 1
  const scaleY = imgRef.current && imgSize.height > 0
    ? imgRef.current.clientHeight / (imgRef.current.naturalHeight || imgSize.height)
    : 1

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4">
      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4">
        <span className="text-purple-300 font-semibold text-sm uppercase tracking-wider">
          Investigation Replay
        </span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Step indicator */}
      <div className="w-full max-w-4xl mb-3 flex items-center gap-3">
        <span className="text-sm text-gray-400">
          Step <span className="text-white font-bold">{step + 1}</span> of{' '}
          <span className="text-white font-bold">{total}</span>
          {' — '}
          <span style={{ color }}>{current.category}</span>
        </span>
        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-purple-500"
            animate={{ width: `${((step + 1) / total) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Screenshot + animated overlay */}
      <div className="relative w-full max-w-4xl rounded-xl overflow-hidden border border-white/10">
        <img
          ref={imgRef}
          src={screenshotUrl}
          alt="Investigation evidence"
          onLoad={handleImageLoad}
          className="w-full block"
        />

        {/* Highlight current pattern */}
        <AnimatePresence mode="wait">
          {bb && imgSize.width > 0 && (
            <motion.div
              key={step}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                position: 'absolute',
                left: bb.x * scaleX,
                top: bb.y * scaleY,
                width: bb.width * scaleX,
                height: bb.height * scaleY,
                border: `3px solid ${color}`,
                borderRadius: 4,
                boxShadow: `0 0 16px 4px ${color}55`,
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Pattern details */}
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-4xl mt-4 bg-[#111827] rounded-xl border border-white/10 p-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold" style={{ color }}>
              {current.category}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{current.element_identifier}</div>
          </div>
          <span
            className="text-xs font-semibold border px-2 py-0.5 rounded-full shrink-0"
            style={{
              borderColor: `${color}66`,
              color,
              backgroundColor: `${color}18`,
            }}
          >
            {current.confidence_level}
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-300 leading-relaxed">{current.explanation}</p>
      </motion.div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-5">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={() => setPlaying((p) => !p)}
          className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-2 transition-colors"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
          disabled={step === total - 1}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
