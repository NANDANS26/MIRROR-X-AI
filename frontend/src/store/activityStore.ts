import { create } from "zustand";

import type { ActivityEvent } from "../types/activity";

interface ActivityStore {
  events: ActivityEvent[];

  addEvent: (
    message: string
  ) => void;

  clearEvents: () => void;
}

export const useActivityStore =
  create<ActivityStore>(
    (set) => ({
      events: [
        {
          id:
            crypto.randomUUID(),

          message:
            "Forensic Engine Ready",

          timestamp:
            new Date()
              .toLocaleTimeString(),
        },

        {
          id:
            crypto.randomUUID(),

          message:
            "Behavior Analysis Models Loaded",

          timestamp:
            new Date()
              .toLocaleTimeString(),
        },

        {
          id:
            crypto.randomUUID(),

          message:
            "Awaiting Evidence",

          timestamp:
            new Date()
              .toLocaleTimeString(),
        },
      ],

      addEvent:
        (message) =>
          set((state) => ({
            events: [
              {
                id:
                  crypto.randomUUID(),

                message,

                timestamp:
                  new Date()
                    .toLocaleTimeString(),
              },

              ...state.events,
            ].slice(0, 15),
          })),

      clearEvents: () =>
        set({
          events: [],
        }),
    })
  );