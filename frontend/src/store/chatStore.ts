import { create } from "zustand";

import type {
    ChatMessage,
    ChatSession,
} from "../types/chat";

interface ChatStore {
  sessions: ChatSession[];

  activeSessionId: string | null;

  createSession: () => void;

  setActiveSession: (
    id: string
  ) => void;

  addMessage: (
    message: ChatMessage
  ) => void;
  
}

export const useChatStore =
  create<ChatStore>((set) => ({
    sessions: [],

    activeSessionId: null,

    createSession: () =>
      set((state) => {
        const session: ChatSession = {
          id: crypto.randomUUID(),

          title: "New Investigation",

          createdAt:
            new Date().toISOString(),

          messages: [],
        };

        return {
          sessions: [
            session,
            ...state.sessions,
          ],

          activeSessionId:
            session.id,
        };
      }),

    setActiveSession: (
      id: string
    ) =>
      set({
        activeSessionId: id,
      }),

    addMessage: (
      message: ChatMessage
    ) =>
      set((state) => ({
        sessions:
          state.sessions.map(
            (session) => {
              if (
                session.id !==
                state.activeSessionId
              ) {
                return session;
              }

              return {
                ...session,

                messages: [
                  ...session.messages,
                  message,
                ],
              };
            }
          ),
      })),
  }));