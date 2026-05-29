import type { ChatMessage as Message } from "../../types/chat";

interface Props {
  message: Message;
}

export default function ChatMessage({
  message,
}: Props) {
  const isUser =
    message.role === "user";

  return (
    <div
      className={`flex mb-6 ${
        isUser
          ? "justify-end"
          : "justify-start"
      }`}
    >
      <div
        className={`
        max-w-3xl
        px-5
        py-4
        rounded-2xl
        whitespace-pre-wrap
        ${
          isUser
            ? "bg-blue-600"
            : "bg-slate-900"
        }
      `}
      >
        {message.content}
      </div>
    </div>
  );
}