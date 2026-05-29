import { useState } from "react";
import { generateMockResponse } from "../../services/mockAI";
import { useChatStore } from "../../store/chatStore";

export default function ChatInput() {
  const [value, setValue] =
    useState("");

  const addMessage =
    useChatStore(
      (state) => state.addMessage
    );

  const sendMessage = () => {
    if (!value.trim()) return;

    addMessage({
      id: crypto.randomUUID(),

      role: "user",

      type: "text",

      content: value,

      timestamp:
        new Date().toISOString(),
    });

    setValue("");
  };

  return (
    <div className="border-t border-slate-800 p-6">
      <div className="max-w-5xl mx-auto flex gap-4">
        <input
          value={value}
          onChange={(e) =>
            setValue(e.target.value)
          }
          placeholder="Ask MIRROR X AI anything..."
          className="
            flex-1
            bg-slate-900
            border
            border-slate-800
            rounded-xl
            px-4
            py-4
            text-white
            outline-none
          "
        />

        <button
          onClick={sendMessage}
          className="
            px-6
            rounded-xl
            bg-blue-600
            hover:bg-blue-500
          "
        >
          Send
        </button>
      </div>
    </div>
  );
}