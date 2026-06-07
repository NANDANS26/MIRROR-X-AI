import { useState } from 'react'
import type { DetectedPattern } from '../../types/analysis'
import { useChatStore } from '../../store/chatStore'

interface Props {
  patterns: DetectedPattern[]
  imageWidth: number
  imageHeight: number
}

const CONFIDENCE_COLORS: Record<DetectedPattern['confidence_level'], string> = {
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#EAB308',
}

interface TooltipState {
  x: number
  y: number
  pattern: DetectedPattern
}

export default function OverlayCanvas({ patterns, imageWidth, imageHeight }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const addMessage = useChatStore((s) => s.addMessage)

  const handlePatternClick = (pattern: DetectedPattern) => {
    addMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      type: 'evidence',
      content: `**${pattern.category}** — ${pattern.explanation}`,
      timestamp: new Date().toISOString(),
      metadata: pattern,
    })
  }

  const patternsWithBox = patterns.filter((p) => p.bounding_box)

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: imageWidth,
        height: imageHeight,
        pointerEvents: 'none',
      }}
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {patternsWithBox.map((pattern, i) => {
        const bb = pattern.bounding_box!
        const color = CONFIDENCE_COLORS[pattern.confidence_level]

        return (
          <g key={i}>
            <rect
              x={bb.x}
              y={bb.y}
              width={bb.width}
              height={bb.height}
              stroke={color}
              strokeWidth={2}
              fill="transparent"
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onMouseEnter={(_e) => {
                setTooltip({
                  x: bb.x + bb.width / 2,
                  y: bb.y,
                  pattern,
                })
              }}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => handlePatternClick(pattern)}
            />
          </g>
        )
      })}

      {/* Tooltip rendered as SVG foreignObject for HTML styling */}
      {tooltip && (
        <foreignObject
          x={Math.min(tooltip.x, imageWidth - 220)}
          y={Math.max(tooltip.y - 100, 4)}
          width={220}
          height={100}
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <div
            style={{
              background: 'rgba(17,24,39,0.97)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: '#e5e7eb',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontWeight: 700, color: CONFIDENCE_COLORS[tooltip.pattern.confidence_level], marginBottom: 2 }}>
              {tooltip.pattern.category}
            </div>
            <div style={{ color: '#9ca3af', marginBottom: 4 }}>
              Confidence: {tooltip.pattern.confidence_level}
            </div>
            <div style={{ lineHeight: 1.4 }}>
              {tooltip.pattern.explanation.slice(0, 200)}
              {tooltip.pattern.explanation.length > 200 ? '…' : ''}
            </div>
          </div>
        </foreignObject>
      )}
    </svg>
  )
}
