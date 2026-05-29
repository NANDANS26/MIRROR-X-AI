import { useChatStore } from "../../store/chatStore";

import ChatMessage from "./ChatMessage";

export default function ChatContainer() {
  const {
    sessions,
    activeSessionId,
  } = useChatStore();

  const activeSession =
    sessions.find(
      (s) => s.id === activeSessionId
    );

  if (!activeSession) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="max-w-5xl mx-auto">
        {activeSession.messages.map(
          (message) => (
            <ChatMessage
              key={message.id}
              message={message}
            />
          )
        )}
      </div>
    </div>
  );
}