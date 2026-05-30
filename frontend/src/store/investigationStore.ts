import { create } from "zustand";

import type { InvestigationEvent } from "../types/investigation";

interface InvestigationStore {
  events: InvestigationEvent[];

  setEvents: (
    events: InvestigationEvent[]
  ) => void;

  updateEvent: (
    id: string,
    status:
      | "pending"
      | "running"
      | "completed"
  ) => void;

  clearEvents: () => void;
}

export const useInvestigationStore =
  create<InvestigationStore>(
    (set) => ({
      events: [],

      setEvents: (events) =>
        set({ events }),

      updateEvent:
        (id, status) =>
          set((state) => ({
            events:
              state.events.map(
                (event) =>
                  event.id === id
                    ? {
                        ...event,
                        status,
                      }
                    : event
              ),
          })),

      clearEvents: () =>
        set({
          events: [],
        }),
    })
  );