import { create } from "zustand";

interface ActionStore {
  action: string | null;

  payload: any;

  triggerAction: (
    action: string,
    payload?: any
  ) => void;

  clearAction: () => void;
}

export const useActionStore =
  create<ActionStore>(
    (set) => ({
      action: null,

      payload: null,

      triggerAction: (
        action,
        payload
      ) =>
        set({
          action,
          payload,
        }),

      clearAction: () =>
        set({
          action: null,
          payload: null,
        }),
    })
  );