/**
 * investigationNarrator.ts — Transforms analysis results into a conversational narrative.
 *
 * Phase 2: Natural investigator tone (not template outputs)
 * Phase 4: Smart no-finding experience
 * Phase 6: Structured investigation narrative
 */

import type { ChatMessage } from '../types/chat'

function extractScore(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  if (typeof val === 'object' && 'score' in val) return Number(val.score) || fallback
  return Number(val) || fallback
}

export const createNarrativeMessages = (analysis: any): ChatMessage[] => {
  const messages: ChatMessage[] = []
  const patterns = analysis?.detected_patterns || []
  const simResults: any[] = analysis?.simulation_results || []
  const scores = analysis?.scores
  const manipulation = extractScore(scores?.manipulation_score, 0)
  const friction = extractScore(scores?.friction_score, 0)

  // ── PHASE 4: Smart no-finding experience ────────────────────────────────────
  if (patterns.length === 0) {
    messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      type: 'message',
      content: `I completed a full forensic sweep of this interface and came up clean.

Here's what I checked:
- **Fake urgency signals** — countdown timers, scarcity language, "only X left" patterns
- **Confirm shaming** — opt-out labels that use guilt or shame language
- **Forced continuity** — auto-renewing subscriptions buried in fine print
- **Visual coercion** — pre-checked boxes, low-contrast decline buttons
- **Hidden costs** — fees revealed only at checkout
- **Roach motel patterns** — easy signup, hard cancellation flows
- **Sneak-into-basket** — items auto-added without explicit consent
- **Misdirection** — deceptive button placement or confusing action labels

None of these exceeded our detection thresholds on this page. A clean result suggests the interface presents user choices transparently — though it's also possible that dark patterns here are more subtle than heuristic rules can detect.

Confidence level: Moderate. OCR-based detection can miss purely visual or CSS-based manipulation. Reviewing pricing, subscription flows, and checkout manually is always worthwhile.`,
      timestamp: new Date().toISOString(),
    })

    // NOTE: Action chips are NOT added here — useWebSocket.handleSessionComplete
    // owns chip generation to prevent duplicates.
    return messages
  }

  // ── PHASE 6: Executive summary ───────────────────────────────────────────────
  const riskLevel = manipulation > 70 ? 'high risk' : manipulation > 40 ? 'moderate risk' : 'low risk'
  const patternNames = [...new Set(patterns.map((p: any) => p.category))].join(', ')

  messages.push({
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'message',
    content: `Investigation complete. I found **${patterns.length} dark pattern signal${patterns.length !== 1 ? 's' : ''}** on this interface, placing it in the **${riskLevel}** category.

The manipulation score of **${Math.round(manipulation)}/100** reflects the concentration and severity of these findings. Detected patterns include: **${patternNames}**.`,
    timestamp: new Date().toISOString(),
  })

  // ── Key findings (evidence cards) ─────────────────────────────────────────────
  for (const pattern of patterns) {
    messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      type: 'evidence',
      content: `**${pattern.category}** — ${pattern.confidence_level || 'Medium'} confidence\n\n${pattern.explanation}`,
      timestamp: new Date().toISOString(),
      metadata: pattern,
    })
  }

  // ── Score card ────────────────────────────────────────────────────────────────
  if (scores) {
    messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      type: 'score',
      content: '',
      timestamp: new Date().toISOString(),
      metadata: scores,
    })
  }

  // ── PHASE 2: Natural user impact summary — bullet points per persona ─────────
  if (simResults.length > 0) {
    const highRiskPersonas = simResults.filter((s: any) => {
      const summary = s.behavioral_summary || ''
      return summary.toLowerCase().includes('significant') || summary.toLowerCase().includes('high')
    })

    if (highRiskPersonas.length > 0) {
      // Format each persona as a markdown bullet point
      const bulletLines = highRiskPersonas
        .map((s: any) => `* **${s.persona}**: ${s.behavioral_summary}`)
        .join('\n')

      messages.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'message',
        content: `**User Impact Analysis**\n\nCertain user groups face heightened risk from these patterns:\n\n${bulletLines}`,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // ── Risk assessment narrative ────────────────────────────────────────────────
  let riskNarrative = ''
  if (manipulation > 70) {
    riskNarrative = `This interface presents serious concerns. With a manipulation score of ${Math.round(manipulation)}, the design actively works against user interests. I'd classify this as **predatory design** — patterns here are not accidental; they're engineered to extract decisions users wouldn't make with full information.`
  } else if (manipulation > 40) {
    riskNarrative = `This interface shows some concerning patterns, but they're not extreme. A manipulation score of ${Math.round(manipulation)} suggests the design nudges users in certain directions without being overtly deceptive. Worth reviewing, particularly on subscription and checkout flows.`
  } else {
    riskNarrative = `This interface scores relatively low on manipulation (${Math.round(manipulation)}). The patterns detected appear mild and may be standard marketing practices rather than intentional dark design. That said, even low scores warrant review on payment and consent flows.`
  }

  if (friction > 40) {
    riskNarrative += ` The **friction score of ${Math.round(friction)}** is notable — this interface makes it harder than necessary to cancel, unsubscribe, or exit.`
  }

  messages.push({
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'message',
    content: riskNarrative,
    timestamp: new Date().toISOString(),
  })

  // ── PHASE 3: Action chips are NOT added here — useWebSocket.handleSessionComplete
  // adds them once after fetching results to avoid duplicates.
  // (The __ACTIONS__ message has been removed from the narrator.)

  return messages
}
