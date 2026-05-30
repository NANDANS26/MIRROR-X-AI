import ReactMarkdown from "react-markdown";

import type { ChatMessage as Msg } from "../../types/chat";

import FileMessage from "./FileMessage";

import EvidenceReveal from "../evidence/EvidenceReveal";

import ScoreNarrative from "../analysis/ScoreNarrative";

interface Props {
  message: Msg;
}

export default function ChatMessage({
  message,
}: Props) {
  // STATUS MESSAGE

  if (message.type === "status") {
    return (
      <div className="text-sm text-purple-300 pl-4">
        {message.content}
      </div>
    );
  }

  // EVIDENCE CARD

  if (
    message.type === "evidence" &&
    message.metadata
  ) {
    return (
      <EvidenceReveal
        category={
          message.metadata.category
        }
        explanation={
          message.metadata.explanation
        }
      />
    );
  }

  // SCORE CARD

  if (
    message.type === "score" &&
    message.metadata
  ) {
    return (
      <ScoreNarrative
        score={
          message.metadata
            .manipulation_score
        }
        trust={
          message.metadata
            .trust_score
        }
        fairness={
          message.metadata
            .ux_fairness_index
        }
      />
    );
  }

  const isUser =
    message.role === "user";

  return (
    <div
      className={`w-full flex ${
        isUser
          ? "justify-end"
          : "justify-start"
      }`}
    >
      <div
        className={`max-w-3xl rounded-2xl px-5 py-4 ${
          isUser
            ? "bg-purple-600"
            : "bg-[#111827]"
        }`}
      >
        <ReactMarkdown>
          {message.content}
        </ReactMarkdown>

        {message.file && (
          <FileMessage
            name={message.file.name}
            preview={
              message.file.preview
            }
          />
        )}
      </div>
    </div>
  );
}