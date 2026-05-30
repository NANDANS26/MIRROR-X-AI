import { useEffect, useRef } from "react";

import ChatMessage from "./ChatMessage";

import TypingIndicator from "./TypingIndicator";

import { useChatStore } from "../../store/chatStore";

export default function ChatContainer() {
  const messages =
    useChatStore(
      (state) => state.messages
    );

  const isTyping =
    useChatStore(
      (state) => state.isTyping
    );

  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-5">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
          />
        ))}

        {isTyping && (
          <TypingIndicator />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}