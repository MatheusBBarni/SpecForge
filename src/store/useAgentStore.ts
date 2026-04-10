import { create } from "zustand";

import type { AgentEventPayload, AgentStatus } from "../types";

interface AgentState {
  status: AgentStatus;
  terminalOutput: string[];
  currentMilestone: string | null;
  pendingDiff: string | null;
  executionSummary: string | null;
  resetRun: () => void;
  appendTerminalOutput: (line: string) => void;
  setStatus: (status: AgentStatus) => void;
  setCurrentMilestone: (milestone: string | null) => void;
  setPendingDiff: (diff: string | null) => void;
  setExecutionSummary: (summary: string | null) => void;
  applyEvent: (payload: AgentEventPayload) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  status: "idle",
  terminalOutput: [],
  currentMilestone: null,
  pendingDiff: null,
  executionSummary: null,
  resetRun: () =>
    set({
      status: "idle",
      terminalOutput: [],
      currentMilestone: null,
      pendingDiff: null,
      executionSummary: null
    }),
  appendTerminalOutput: (line) =>
    set((state) => ({
      terminalOutput: [...state.terminalOutput, line].slice(-240)
    })),
  setStatus: (status) => set({ status }),
  setCurrentMilestone: (currentMilestone) => set({ currentMilestone }),
  setPendingDiff: (pendingDiff) => set({ pendingDiff }),
  setExecutionSummary: (executionSummary) => set({ executionSummary }),
  applyEvent: (payload) =>
    set({
      status: payload.status,
      currentMilestone: payload.currentMilestone,
      pendingDiff: payload.pendingDiff,
      executionSummary: payload.summary
    })
}));
