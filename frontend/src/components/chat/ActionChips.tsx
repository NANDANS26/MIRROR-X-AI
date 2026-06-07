/**
 * ActionChips.tsx — Deterministic investigation action buttons.
 *
 * ARCHITECTURE: Every button maps to a local action handler in EvidenceController.
 * Zero Gemini calls. Works when AI is offline, rate-limited, or quota-exhausted.
 *
 * Only "Generate Forensic Report" triggers a network call (PDF download).
 * All other buttons read from session data in the store.
 */

import { motion } from 'framer-motion'
import { useActionStore } from '../../store/actionStore'
import { useChatStore } from '../../store/chatStore'
import { useChat } from '../../hooks/useChat'

// Maps chip label → EvidenceController action name
const ACTION_MAP: Record<string, string> = {
  // Investigation action buttons (deterministic — no Gemini)
  'Explain Findings':               'EXPLAIN_FINDINGS',
  'Show Evidence':                  'SHOW_EVIDENCE',
  'Who Is Most Affected?':          'WHO_IS_AFFECTED',
  'Suggest Ethical Redesign':       'ETHICAL_REDESIGN',
  'View Risk Breakdown':            'SHOW_SCORE',
  'Show Detection Criteria':        'SHOW_DETECTION_CRITERIA',
  // No-pattern investigation buttons
  'Why Was This Considered Safe?':  'EXPLAIN_FINDINGS',
  'What Did You Check?':            'SHOW_DETECTION_CRITERIA',
  'Could Anything Have Been Missed?': 'EXPLAIN_FINDINGS',
  'Compare Against Known Dark Patterns': 'SHOW_DETECTION_CRITERIA',
  // Report (network call, but not Gemini)
  // Legacy
  'Explain a Finding':              'EXPLAIN_FINDINGS',
  'View Risk Breakdown ':           'SHOW_SCORE',
  'Replay Manipulation Sequence':   'START_REPLAY',
  'Generate PDF Report':            'GENERATE_REPORT',
  'Highlight Suspicious Areas':     'SHOW_HIDDEN_COSTS',
}

// Chips that fall through to Gemini chat (open-ended / free-form only)
// These are intentionally left empty — all current chip labels are deterministic.
// Free-form chat is still available via the text input.
const GEMINI_CHIPS = new Set<string>([])

interface Props {
  actions: string[]
}

export default function ActionChips({ actions }: Props) {
  const { triggerAction } = useActionStore()
  const { sendMessage } = useChat()
  const addMessage = useChatStore((s) => s.addMessage)

  const handleAction = async (label: string) => {
    // Always add user message first for UX continuity
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      type: 'message',
      content: label,
      timestamp: new Date().toISOString(),
    })

    // Check deterministic action map first
    const mappedAction = ACTION_MAP[label]
    if (mappedAction) {
      triggerAction(mappedAction)
      return
    }

    // Gemini-routed chips (open-ended questions — currently none in default sets)
    if (GEMINI_CHIPS.has(label)) {
      await sendMessage(null, label)
      return
    }

    // Final fallback: send through Gemini chat
    await sendMessage(null, label)
  }

  if (actions.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {actions.map((label, i) => (
        <motion.button
          key={label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => handleAction(label)}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: '6px 14px',
            borderRadius: 8,
            background: 'rgba(124,58,237,0.12)',
            border: '1px solid rgba(124,58,237,0.4)',
            color: '#c084fc',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(124,58,237,0.25)'
            e.currentTarget.style.borderColor = 'rgba(124,58,237,0.7)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(124,58,237,0.12)'
            e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'
          }}
        >
          {label}
        </motion.button>
      ))}
    </div>
  )
}
