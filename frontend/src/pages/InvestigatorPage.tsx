import { useEffect } from "react";

import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

import ChatContainer from "../components/chat/ChatContainer";
import ChatInput from "../components/chat/ChatInput";

import { useChatStore } from "../store/chatStore";

export default function InvestigatorPage() {
  const {
    sessions,
    createSession,
    addMessage,
  } = useChatStore();

  useEffect(() => {
    if (sessions.length === 0) {
      createSession();

      setTimeout(() => {
        addMessage({
          id: crypto.randomUUID(),

          role: "assistant",

          type: "text",

          timestamp:
            new Date().toISOString(),

          content:
            `Hello. I'm MIRROR X AI.

I investigate manipulative digital experiences.

Upload a screenshot, paste a URL, or describe something suspicious.

I'll walk you through the investigation.`,
        });
      }, 300);
    }
  }, []);

  return (
    <div className="h-screen flex bg-[#050816] text-white">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <ChatContainer />

        <ChatInput />
      </div>
    </div>
  );
}