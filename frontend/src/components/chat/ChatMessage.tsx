import ReactMarkdown from 'react-markdown'
import type { ChatMessage as Msg } from '../../types/chat'
import FileMessage from './FileMessage'
import EvidenceReveal from '../evidence/EvidenceReveal'
import ScoreNarrative from '../analysis/ScoreNarrative'
import SpotlightReveal from '../evidence/SpotlightReveal'
import ActionChips from './ActionChips'

interface Props {
  message: Msg
  skipAnimation?: boolean
}

export default function ChatMessage({ message }: Props) {
  // STATUS MESSAGE — dimmed pipeline progress line
  if (message.type === 'status') {
    return (
      <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.7)', paddingLeft: 8 }}>
        {message.content}
      </div>
    )
  }

  if (message.type === 'spotlight') {
    return (
      <SpotlightReveal
        image={message.metadata?.image}
        explanation={message.metadata?.explanation}
      />
    )
  }

  // EVIDENCE CARD
  if (message.type === 'evidence' && message.metadata) {
    return (
      <EvidenceReveal
        category={message.metadata.category}
        explanation={message.metadata.explanation}
      />
    )
  }

  // SCORE CARD
  if (message.type === 'score' && message.metadata) {
    return (
      <ScoreNarrative
        scores={message.metadata}
        score={message.metadata.manipulation_score}
        trust={message.metadata.trust_score}
        fairness={message.metadata.ux_fairness_index}
      />
    )
  }

  // REPORT MESSAGE
  if (message.type === 'report' && message.metadata?.downloadUrl) {
    return (
      <div className="mt-3 rounded-xl border border-purple-500/20 bg-[#111827] p-4">
        <div className="text-sm text-gray-300 mb-3">{message.content}</div>
        <a
          href={message.metadata.downloadUrl}
          download={message.metadata.filename || 'report.pdf'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-xl transition-colors"
        >
          ⬇ Download Forensic Report
        </a>
      </div>
    )
  }

  // INLINE ACTION CHIPS — appear in message stream after each AI response
  if (message.metadata?.type === 'action_chips') {
    const chips: string[] = message.metadata.actions || []
    if (chips.length === 0) return null
    return <ActionChips actions={chips} />
  }

  // Empty content guard
  if (!message.content?.trim()) return null

  const isUser = message.role === 'user'

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs ${
          isUser ? 'bg-purple-600' : 'bg-[#111827]'
        }`}
      >
        {isUser ? (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {message.file && (
          <FileMessage name={message.file.name} preview={message.file.preview} />
        )}
      </div>
    </div>
  )
}
