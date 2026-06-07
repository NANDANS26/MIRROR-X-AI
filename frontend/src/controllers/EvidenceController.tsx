/**
 * EvidenceController.tsx — Deterministic investigation action handlers.
 *
 * ARCHITECTURE: All investigation action buttons generate responses entirely
 * from locally-stored session data. Zero Gemini calls. Zero network requests
 * (except report download). Works when Gemini is offline, rate-limited, or
 * quota-exhausted.
 *
 * Handled actions:
 *   EXPLAIN_FINDINGS   — manipulation score + pattern list with confidence
 *   SHOW_EVIDENCE      — each detected pattern with full explanation
 *   WHO_IS_AFFECTED    — simulation results per persona
 *   ETHICAL_REDESIGN   — rule-based redesign recommendations per pattern
 *   SHOW_SCORE         — full scoring breakdown with contributions
 *   SHOW_DETECTION_CRITERIA — what the rule engine checks and why
 *   SHOW_HIDDEN_COSTS  — spotlight on evidence image
 *   START_REPLAY       — investigation replay modal
 *   GENERATE_REPORT    — PDF download
 */

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useActionStore } from '../store/actionStore'
import { useChatStore } from '../store/chatStore'
import { useAgentStore } from '../store/agentStore'
import { useActivityStore } from '../store/activityStore'
import { useInvestigationSessionStore } from '../store/investigationSessionStore'
import InvestigationReplay from '../components/replay/InvestigationReplay'
import type { DetectedPattern } from '../types/analysis'

// ---------------------------------------------------------------------------
// Redesign recommendations — deterministic, per pattern category
// ---------------------------------------------------------------------------

const REDESIGN_RECS: Record<string, string> = {
  'Fake Urgency':
    'Remove artificial deadlines and countdown timers. If a real deadline exists, state it plainly without alarm styling. Users respond better to transparency than pressure.',
  'Confirm Shaming':
    'Replace guilt-framing opt-out text with neutral language. "No thanks" is always acceptable. Users who decline are not making a mistake.',
  'Forced Continuity':
    'Present subscription terms on the same screen as the sign-up action. Provide a clearly labelled cancel path accessible within one click from the account page.',
  'Visual Coercion':
    'Default all checkboxes to unchecked. Users must actively opt in — default opt-in removes informed consent. Use equal visual weight for all options.',
  'Roach Motel':
    'Make cancellation as easy as sign-up. The cancel flow should require the same number of steps or fewer than the join flow.',
  'Sneak Into Basket':
    'Never add items to a cart without explicit user selection. Pre-bundled offers must be clearly labelled and removable before checkout.',
  'Misdirection':
    'Use equal visual weight for accept and decline actions. A decline link should be the same size, colour, and prominence as the accept button.',
  'Hidden Costs':
    'Show the complete price — including taxes, fees, and add-ons — before the payment step. Surprises at checkout destroy trust.',
  'Price Anchoring':
    'If displaying a reference price, it must be a genuine, previously-charged price. Fabricated "original" prices are deceptive pricing under most consumer protection frameworks.',
  'Visual Steering':
    'Ensure the accept and decline options have equivalent visual prominence. The design should not encode a preferred choice through size, colour, or position alone.',
}

const DEFAULT_REDESIGN =
  'Review the detected elements against ethical design principles. ' +
  'Prioritise user autonomy: make sure every choice on this page can be freely declined without penalty or guilt.'

// ---------------------------------------------------------------------------
// Detection criteria — what the rule engine actually checks
// ---------------------------------------------------------------------------

const DETECTION_CRITERIA = `**What MIRROR X AI checks for:**

**Fake Urgency** — Countdown timers, "expires in", "hurry", "only X left", time-limited offer language, HH:MM:SS format clock strings.

**Confirm Shaming** — "No thanks, I hate saving", "I don't want", opt-out phrases that imply the user is making a foolish decision.

**Forced Continuity** — Free trial language, auto-renew mentions, subscription references without clear cancellation paths.

**Visual Coercion** — Pre-checked checkboxes in HTML (\`<input checked>\`), "pre-selected", "automatically selected", low-contrast decline styling.

**Roach Motel** — Easy sign-up language ("join free", "start trial") combined with no detectable cancellation path in the page content.

**Sneak Into Basket** — "Added automatically", "included by default", auto-added item language.

**Misdirection** — Decline language positioned as the primary action label, "No I don't want", "skip this offer", "I prefer full price".

**Price Anchoring** — Side-by-side prices suggesting a discount, "was / reg / original price", "you save", "discount applied", crossed-out pricing.

**Scarcity Messaging** — "Only X left", "limited availability", "selling fast", "today only", "one-time offer", "act now".

**Visual Steering** — Dominant CTA ("YES! Claim my discount") paired with shamed decline link ("No thanks, I'll pay full price").

**Confidence levels:** Low = 1 signal matched. Medium = 2–3 signals. High = 4+ signals.

Detection is based on OCR text analysis and DOM HTML inspection. Visual-only manipulation (CSS contrast abuse, pixel-level tricks) may not be captured without manual review.`

// ---------------------------------------------------------------------------
// Helper to extract score number safely
// ---------------------------------------------------------------------------

function extractScore(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : Math.round(val)
  if (typeof val === 'object' && val !== null && 'score' in val) {
    return Math.round(Number((val as { score: unknown }).score) || fallback)
  }
  return Math.round(Number(val) || fallback)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EvidenceController() {
  const { action, payload, clearAction } = useActionStore()
  const addMessage = useChatStore((s) => s.addMessage)
  const activeChips = useChatStore((s) => s.activeChips)
  const setState = useAgentStore((s) => s.setState)
  const addEvent = useActivityStore((s) => s.addEvent)
  const session = useInvestigationSessionStore((s) => s.session)
  const sessionId = useInvestigationSessionStore((s) => s.sessionId)

  const [replayActive, setReplayActive] = useState(false)
  const [replayPatterns, setReplayPatterns] = useState<DetectedPattern[]>([])
  const [replayScreenshot, setReplayScreenshot] = useState('')

  // Helper: add the active chips as follow-up after every deterministic response
  const appendChips = () => {
    if (activeChips.length > 0) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: '',
        metadata: { type: 'action_chips', actions: activeChips },
        timestamp: new Date().toISOString(),
      })
    }
  }

  const noSession = () => {
    addMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      type: 'message',
      content: 'No investigation session is available. Upload a screenshot or submit a URL first.',
      timestamp: new Date().toISOString(),
    })
    clearAction()
  }

  useEffect(() => {
    if (!action) return

    // ── EXPLAIN_FINDINGS ───────────────────────────────────────────────────────
    if (action === 'EXPLAIN_FINDINGS') {
      if (!session) { noSession(); return }

      const patterns: any[] = session.analysis?.detected_patterns || session.patterns || []
      const scores = session.analysis?.scores || session.scores
      const manipulation = extractScore(scores?.manipulation_score)
      const trust = extractScore(scores?.trust_score, 100)
      const fairness = scores?.ux_fairness_index ?? 'Unknown'

      setState('explaining')
      addEvent('Explaining Findings')

      if (patterns.length === 0) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: `No dark patterns were detected on this interface.

**Scores:**
- Manipulation: ${manipulation}/100
- Trust: ${trust}/100
- UX Fairness: ${fairness}

The heuristic rule engine checked for fake urgency, confirm shaming, forced continuity, visual coercion, roach motel patterns, sneak-into-basket behaviour, misdirection, hidden costs, price anchoring, scarcity messaging, and visual steering. None of these exceeded the detection threshold.

This does not guarantee the interface is completely ethical — visual manipulation through CSS or purely graphical techniques may not be captured by text-based analysis.`,
          timestamp: new Date().toISOString(),
        })
      } else {
        const riskLabel = manipulation > 70 ? 'high risk' : manipulation > 40 ? 'moderate risk' : 'low risk'
        const categories = [...new Set(patterns.map((p: any) => p.category))].join(', ')
        const lines = patterns.map((p: any, i: number) =>
          `**${i + 1}. ${p.category}** (${p.confidence_level || 'Medium'} confidence)\n${p.explanation || p.element_identifier}`
        ).join('\n\n')

        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: `**Investigation Summary — ${riskLabel.toUpperCase()}**

Manipulation score: **${manipulation}/100** | Trust score: **${trust}/100** | Fairness: **${fairness}**

**${patterns.length} dark pattern signal${patterns.length !== 1 ? 's' : ''} detected:** ${categories}

---

${lines}`,
          timestamp: new Date().toISOString(),
        })
      }

      appendChips()
      setTimeout(() => setState('idle'), 500)
      clearAction()
      return
    }

    // ── SHOW_EVIDENCE ──────────────────────────────────────────────────────────
    if (action === 'SHOW_EVIDENCE') {
      if (!session) { noSession(); return }

      const patterns: any[] = session.analysis?.detected_patterns || session.patterns || []
      setState('explaining')
      addEvent('Showing Evidence')

      if (patterns.length === 0) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: 'No patterns were detected, so there is no evidence to display. The interface passed all heuristic checks.',
          timestamp: new Date().toISOString(),
        })
      } else {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: `**Evidence — ${patterns.length} detected signal${patterns.length !== 1 ? 's' : ''}**`,
          timestamp: new Date().toISOString(),
        })
        patterns.forEach((p: any) => {
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            type: 'evidence',
            content: `**${p.category}** — ${p.confidence_level || 'Medium'} confidence\n\n${p.explanation || p.element_identifier}`,
            timestamp: new Date().toISOString(),
            metadata: p,
          })
        })
      }

      appendChips()
      setTimeout(() => setState('idle'), 500)
      clearAction()
      return
    }

    // ── WHO_IS_AFFECTED ────────────────────────────────────────────────────────
    if (action === 'WHO_IS_AFFECTED') {
      if (!session) { noSession(); return }

      const simResults: any[] = session.analysis?.simulation_results || []
      setState('explaining')
      addEvent('Analyzing User Impact')

      if (simResults.length === 0) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: `**User Impact**

No simulation results are available for this investigation. Simulation data is generated when dark patterns are detected.

As a general note: manipulative design disproportionately affects users with lower digital literacy, cognitive load (distracted or tired users), users making time-pressured decisions, and users who are unfamiliar with a product or service category.`,
          timestamp: new Date().toISOString(),
        })
      } else {
        const lines = simResults.map((s: any) => {
          const summary = s.behavioral_summary || 'No behavioral summary available.'
          const confusions = (s.confusion_points || []).length
          const pressures = (s.pressure_points || []).length
          return `**${s.persona}**\n${summary}\n${confusions > 0 ? `${confusions} confusion point${confusions !== 1 ? 's' : ''} identified.` : ''} ${pressures > 0 ? `${pressures} pressure point${pressures !== 1 ? 's' : ''} identified.` : ''}`.trim()
        }).join('\n\n---\n\n')

        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: `**User Impact — Simulation Results**

Four user personas were simulated against the detected patterns:\n\n${lines}`,
          timestamp: new Date().toISOString(),
        })
      }

      appendChips()
      setTimeout(() => setState('idle'), 500)
      clearAction()
      return
    }

    // ── ETHICAL_REDESIGN ───────────────────────────────────────────────────────
    if (action === 'ETHICAL_REDESIGN') {
      if (!session) { noSession(); return }

      const patterns: any[] = session.analysis?.detected_patterns || session.patterns || []
      setState('explaining')
      addEvent('Generating Ethical Redesign Recommendations')

      if (patterns.length === 0) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: `**Ethical Redesign Recommendations**

No dark patterns were detected on this interface, so no specific remediation is required.

For continued ethical design practice:
- Default all checkboxes to unchecked
- Make subscription and cancellation terms equally prominent
- Avoid countdown timers unless tied to real, verifiable deadlines
- Ensure accept and decline actions have equal visual weight
- Show complete pricing before the payment step`,
          timestamp: new Date().toISOString(),
        })
      } else {
        const uniqueCategories = [...new Set(patterns.map((p: any) => p.category as string))]
        const recLines = uniqueCategories.map((cat) => {
          const rec = REDESIGN_RECS[cat] || DEFAULT_REDESIGN
          return `**${cat}**\n${rec}`
        }).join('\n\n')

        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: `**Ethical Redesign Recommendations**

Based on the ${patterns.length} detected pattern${patterns.length !== 1 ? 's' : ''}, here are specific remediation steps:\n\n${recLines}`,
          timestamp: new Date().toISOString(),
        })
      }

      appendChips()
      setTimeout(() => setState('idle'), 500)
      clearAction()
      return
    }

    // ── SHOW_SCORE ─────────────────────────────────────────────────────────────
    if (action === 'SHOW_SCORE') {
      if (!session) { noSession(); return }

      const scores = session.analysis?.scores || session.scores
      setState('explaining')
      addEvent('Showing Risk Breakdown')

      if (!scores) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: 'Scoring data is not available for this session. Please re-run the analysis.',
          timestamp: new Date().toISOString(),
        })
      } else {
        // Render score card
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'score',
          content: '',
          timestamp: new Date().toISOString(),
          metadata: scores,
        })

        // Add text breakdown
        const manipulation = extractScore(scores.manipulation_score)
        const trust = extractScore(scores.trust_score, 100)
        const friction = extractScore(scores.friction_score)
        const fairness = scores.ux_fairness_index ?? 'Unknown'

        const manContribs: any[] = scores.manipulation_score?.contributions || []
        const contribLines = manContribs.length > 0
          ? manContribs.map((c: any) => `- **${c.pattern_name}**: +${c.points} manipulation points`).join('\n')
          : '- No pattern contributions recorded.'

        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: `**Risk Score Breakdown**

| Metric | Score |
|---|---|
| Manipulation | ${manipulation}/100 |
| Trust | ${trust}/100 |
| Friction | ${friction}/100 |
| UX Fairness | ${fairness} |

**Manipulation score contributions:**
${contribLines}

**Interpretation:** ${
  manipulation > 70
    ? 'This interface scores in the high-risk range. The design actively works against user interests.'
    : manipulation > 40
    ? 'Moderate risk. Some patterns nudge users in directions they might not freely choose.'
    : 'Low manipulation score. Detected patterns appear mild.'
}`,
          timestamp: new Date().toISOString(),
        })
      }

      appendChips()
      setTimeout(() => setState('idle'), 500)
      clearAction()
      return
    }

    // ── SHOW_DETECTION_CRITERIA ────────────────────────────────────────────────
    if (action === 'SHOW_DETECTION_CRITERIA') {
      setState('explaining')
      addEvent('Showing Detection Criteria')
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: DETECTION_CRITERIA,
        timestamp: new Date().toISOString(),
      })
      appendChips()
      setTimeout(() => setState('idle'), 500)
      clearAction()
      return
    }

    // ── SHOW_HIDDEN_COSTS ──────────────────────────────────────────────────────
    if (action === 'SHOW_HIDDEN_COSTS') {
      if (!session) { noSession(); return }
      setState('explaining')
      addEvent('Opening Evidence Spotlight')
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'spotlight',
        content: '',
        timestamp: new Date().toISOString(),
        metadata: { image: session.image || '', explanation: 'Highlighted evidence region.' },
      })
      appendChips()
      setTimeout(() => setState('idle'), 2000)
      clearAction()
      return
    }

    // ── START_REPLAY ───────────────────────────────────────────────────────────
    if (action === 'START_REPLAY') {
      if (!session) { noSession(); return }
      const patterns: DetectedPattern[] = session.analysis?.detected_patterns || session.patterns || []
      if (patterns.length < 2) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: 'At least 2 patterns are required to generate a replay.',
          timestamp: new Date().toISOString(),
        })
        clearAction()
        return
      }
      addEvent('Starting Investigation Replay')
      setReplayPatterns(patterns)
      setReplayScreenshot(session.image || '')
      setReplayActive(true)
      clearAction()
      return
    }

    // ── GENERATE_REPORT ────────────────────────────────────────────────────────
    if (action === 'GENERATE_REPORT') {
      if (!session) { noSession(); return }
      const reportSessionId: string | undefined =
        sessionId || session.analysis?.session_id || (payload as any)?.sessionId
      if (!reportSessionId) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'message',
          content: 'Session ID not found. Please re-run the analysis.',
          timestamp: new Date().toISOString(),
        })
        clearAction()
        return
      }
      addEvent('Generating Forensic Report')
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'status',
        content: 'Generating forensic PDF report...',
        timestamp: new Date().toISOString(),
      })
      const token = localStorage.getItem('token')
      axios
        .get(`http://localhost:3001/api/report/${reportSessionId}`, {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        .then((response) => {
          const blob = new Blob([response.data], { type: 'application/pdf' })
          const objectUrl = URL.createObjectURL(blob)
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            type: 'report',
            content: 'Your forensic report is ready.',
            timestamp: new Date().toISOString(),
            metadata: { downloadUrl: objectUrl, filename: `mirror-x-report-${reportSessionId}.pdf` },
          })
          appendChips()
        })
        .catch(() => {
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            type: 'message',
            content: 'Failed to generate the report. Please try again.',
            timestamp: new Date().toISOString(),
          })
          appendChips()
        })
      clearAction()
      return
    }

  }, [action, payload]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <InvestigationReplay
        patterns={replayPatterns}
        screenshotUrl={replayScreenshot}
        isActive={replayActive}
        onClose={() => setReplayActive(false)}
      />
    </>
  )
}
