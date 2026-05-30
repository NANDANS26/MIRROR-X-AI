import ReactMarkdown from "react-markdown";
import FileMessage from "./FileMessage";
import type { ChatMessage as Msg } from "../../types/chat";

interface Props {
  message: Msg;
}

export default function ChatMessage({
  message,
}: Props) {
    if (
        message.type === "status"
    ) {
    return (
        <div className="text-sm text-purple-300 pl-4">
        {message.content}
        </div>
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
            preview={message.file.preview}
        />
        )}
      </div>
    </div>
  );
}