import {
  useRef,
  useState,
} from "react";

import {
  Paperclip,
  Send,
} from "lucide-react";

import { useChatStore } from "../../store/chatStore";

export default function ChatInput() {
  const [message, setMessage] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const addMessage =
    useChatStore(
      (state) => state.addMessage
    );

  const setTyping =
    useChatStore(
      (state) => state.setTyping
    );

  const sendMessage =
    async () => {
      if (
        !message.trim() &&
        !selectedFile
      )
        return;

      const userMessage =
        message.trim();

      let preview = "";

      if (selectedFile) {
        preview =
          URL.createObjectURL(
            selectedFile
          );
      }

      addMessage({
        id: crypto.randomUUID(),

        role: "user",

        type: "message",

        content:
          userMessage ||
          "Uploaded screenshot",

        timestamp:
          new Date().toISOString(),

        file: selectedFile
          ? {
              name:
                selectedFile.name,

              preview,
            }
          : undefined,
      });

      setMessage("");

      setTyping(true);

      const steps = [
        "Scanning interface structure...",
        "Detecting urgency indicators...",
        "Evaluating interaction pressure...",
        "Cross-referencing manipulation patterns...",
        "Generating forensic explanation...",
      ];

      let delay = 1000;

      for (const step of steps) {
        setTimeout(() => {
          addMessage({
            id:
              crypto.randomUUID(),

            role:
              "assistant",

            type:
              "status",

            content:
              step,

            timestamp:
              new Date()
                .toISOString(),
          });
        }, delay);

        delay += 1200;
      }

      setTimeout(() => {
        addMessage({
          id:
            crypto.randomUUID(),

          role:
            "assistant",

          type:
            "message",

          content:
            "Investigation complete.\n\nI detected several potential manipulation signals. Real backend analysis integration will replace this simulation in the next step.",

          timestamp:
            new Date()
              .toISOString(),
        });

        setTyping(false);

        setSelectedFile(null);
      }, delay);
    };

  return (
    <div className="border-t border-white/10 p-5">
      <div className="max-w-5xl mx-auto">
        <div className="bg-[#111827] rounded-2xl flex items-center gap-3 px-4 py-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file =
                e.target.files?.[0];

              if (!file) return;

              setSelectedFile(file);
            }}
          />

          <button
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <Paperclip size={18} />
          </button>

          <input
            value={message}
            onChange={(e) =>
              setMessage(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter"
              ) {
                sendMessage();
              }
            }}
            placeholder="Ask MIRROR X AI anything..."
            className="flex-1 bg-transparent outline-none text-white"
          />

          <button
            onClick={sendMessage}
          >
            <Send size={18} />
          </button>
        </div>

        {selectedFile && (
          <div className="mt-3 text-sm text-purple-300">
            Attached:
            {" "}
            {selectedFile.name}
          </div>
        )}
      </div>
    </div>
  );
}