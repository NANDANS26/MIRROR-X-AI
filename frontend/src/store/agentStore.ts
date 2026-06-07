import { create } from "zustand";

export type AgentState =
  | "idle"
  | "thinking"
  | "investigating"
  | "warning"
  | "explaining";

interface AgentStore {
  state: AgentState;

  setState: (
    state: AgentState
  ) => void;
}

export const useAgentStore =
  create<AgentStore>((set) => ({
    state: "idle",

    setState: (state) =>
      set({ state }),
  }));