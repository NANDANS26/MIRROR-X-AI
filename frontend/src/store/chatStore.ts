import { create } from "zustand";

import type { ChatMessage } from "../types/chat";

interface ChatStore {
  messages: ChatMessage[];

  isTyping: boolean;

  addMessage: (
    message: ChatMessage
  ) => void;

  setTyping: (
    value: boolean
  ) => void;

  clearChat: () => void;
}

export const useChatStore =
  create<ChatStore>((set) => ({
    messages: [
      {
        id: "welcome",

        role: "assistant",

        content:
          "Hello. I'm MIRROR X AI.\n\nUpload a screenshot or share a URL and I'll investigate potential manipulation patterns, explain my reasoning, and guide you through the findings.",

        timestamp:
          new Date().toISOString(),
      },
    ],

    isTyping: false,

    addMessage: (message) =>
      set((state) => ({
        messages: [
          ...state.messages,
          message,
        ],
      })),

    setTyping: (value) =>
      set({
        isTyping: value,
      }),

    clearChat: () =>
      set({
        messages: [],
      }),
  }));