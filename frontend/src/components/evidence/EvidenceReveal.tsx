import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import type { DetectedPattern } from '../../types/analysis'
import OverlayCanvas from './OverlayCanvas'

interface Props {
  imageUrl?: string
  patterns?: DetectedPattern[]
  // Legacy props kept for backward-compat with old evidence card usage
  category?: string
  explanation?: string
}

export default function EvidenceReveal({ imageUrl, patterns, category, explanation }: Props) {
  const [showOverlay, setShowOverlay] = useState(true)
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  // Legacy evidence card (no imageUrl)
  if (!imageUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 rounded-xl border border-red-500/20 bg-[#111827] p-4"
      >
        <div className="text-red-400 font-semibold">{category}</div>
        <div className="mt-2 text-gray-300 text-sm">{explanation}</div>
      </motion.div>
    )
  }

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImgSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      })
    }
  }

  const activePatternsWithBox = (patterns || []).filter((p) => p.bounding_box)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#111827]"
    >
      {/* Header / toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Evidence Screenshot
        </span>
        <button
          onClick={() => setShowOverlay((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-100 transition-colors"
        >
          {showOverlay ? <EyeOff size={14} /> : <Eye size={14} />}
          {showOverlay ? 'Hide Overlay' : 'Show Overlay'}
        </button>
      </div>

      {/* Screenshot + overlay wrapper */}
      <div className="relative inline-block w-full">
        <motion.img
          ref={imgRef}
          src={imageUrl}
          alt="Evidence screenshot"
          onLoad={handleImageLoad}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full block"
          style={{ display: 'block' }}
        />

        {/* Overlay borders — staggered entrance */}
        <AnimatePresence>
          {showOverlay && imgSize.width > 0 && activePatternsWithBox.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {/* Scale SVG to match rendered image size */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                {activePatternsWithBox.map((pattern, i) => {
                  const bb = pattern.bounding_box!
                  const scaleX = imgRef.current ? imgRef.current.clientWidth / imgSize.width : 1
                  const scaleY = imgRef.current ? imgRef.current.clientHeight / imgSize.height : 1

                  const colors: Record<DetectedPattern['confidence_level'], string> = {
                    High: '#EF4444',
                    Medium: '#F59E0B',
                    Low: '#EAB308',
                  }
                  const color = colors[pattern.confidence_level]

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.15 + 0.3, duration: 0.4 }}
                      style={{
                        position: 'absolute',
                        left: bb.x * scaleX,
                        top: bb.y * scaleY,
                        width: bb.width * scaleX,
                        height: bb.height * scaleY,
                        border: `2px solid ${color}`,
                        borderRadius: 2,
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                      }}
                    />
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full SVG overlay (with click + tooltip) when rendered size matches natural size */}
        <AnimatePresence>
          {showOverlay && imgSize.width > 0 && patterns && patterns.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: imgRef.current?.clientWidth,
                height: imgRef.current?.clientHeight,
              }}
            >
              <OverlayCanvas
                patterns={patterns}
                imageWidth={imgRef.current?.clientWidth || imgSize.width}
                imageHeight={imgRef.current?.clientHeight || imgSize.height}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
