import { create } from "zustand";

import type {
  AgentStatus,
  ChatContextItem,
  ChatRuntimeState,
  ChatSession,
  ChatSessionSummary
} from "../types";

interface ChatStoreState {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  loadedSessions: Record<string, ChatSession>;
  drafts: Record<string, string>;
  cavemanReady: boolean;
  cavemanMessage: string;
  cavemanChecking: boolean;
  setSessions: (sessions: ChatSessionSummary[]) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  upsertSession: (session: ChatSession) => void;
  setDraft: (sessionId: string, draft: string) => void;
  setContextItems: (sessionId: string, items: ChatContextItem[]) => void;
  setSessionConfig: (payload: {
    sessionId: string;
    selectedModel: ChatSession["selectedModel"];
    selectedReasoning: ChatSession["selectedReasoning"];
    autonomyMode: ChatSession["autonomyMode"];
  }) => void;
  deleteSession: (sessionId: string, nextActiveSessionId: string | null) => void;
  setCavemanStatus: (payload: {
    ready: boolean;
    message: string;
    checking?: boolean;
  }) => void;
}

function buildIdleRuntime(): ChatRuntimeState {
  return {
    status: "idle",
    terminalOutput: [],
    currentMilestone: null,
    pendingDiff: null,
    executionSummary: null,
    awaitingApproval: false,
    lastError: null,
    isBusy: false,
    pendingRequest: null
  };
}

function toSummary(session: ChatSession): ChatSessionSummary {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    lastMessagePreview: session.lastMessagePreview,
    selectedModel: session.selectedModel,
    selectedReasoning: session.selectedReasoning,
    autonomyMode: session.autonomyMode
  };
}

function sortSessions(sessions: ChatSessionSummary[]) {
  return [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getActiveChatRuntime(
  sessions: Record<string, ChatSession>,
  activeSessionId: string | null
): ChatRuntimeState {
  if (!activeSessionId) {
    return buildIdleRuntime();
  }

  return sessions[activeSessionId]?.runtime ?? buildIdleRuntime();
}

export function getActiveChatStatus(
  sessions: Record<string, ChatSession>,
  activeSessionId: string | null
): AgentStatus {
  return getActiveChatRuntime(sessions, activeSessionId).status;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  sessions: [],
  activeSessionId: null,
  loadedSessions: {},
  drafts: {},
  cavemanReady: true,
  cavemanMessage: "Caveman mode is built into every topic.",
  cavemanChecking: false,
  setSessions: (sessions) =>
    set((state) => {
      const visibleSessionIds = new Set(sessions.map((session) => session.id));
      const nextLoadedSessions = Object.fromEntries(
        Object.entries(state.loadedSessions).filter(([sessionId]) =>
          visibleSessionIds.has(sessionId)
        )
      );
      const nextDrafts = Object.fromEntries(
        Object.entries(state.drafts).filter(([sessionId]) => visibleSessionIds.has(sessionId))
      );

      return {
        sessions: sortSessions(sessions),
        loadedSessions: nextLoadedSessions,
        drafts: nextDrafts
      };
    }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  upsertSession: (session) =>
    set((state) => ({
      loadedSessions: {
        ...state.loadedSessions,
        [session.id]: session
      },
      sessions: sortSessions([
        ...state.sessions.filter((entry) => entry.id !== session.id),
        toSummary(session)
      ])
    })),
  setDraft: (sessionId, draft) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [sessionId]: draft
      }
    })),
  setContextItems: (sessionId, items) =>
    set((state) => {
      const session = state.loadedSessions[sessionId];

      if (!session) {
        return state;
      }

      return {
        loadedSessions: {
          ...state.loadedSessions,
          [sessionId]: {
            ...session,
            contextItems: items
          }
        }
      };
    }),
  setSessionConfig: (payload) =>
    set((state) => {
      const session = state.loadedSessions[payload.sessionId];

      if (!session) {
        return state;
      }

      const nextSession: ChatSession = {
        ...session,
        selectedModel: payload.selectedModel,
        selectedReasoning: payload.selectedReasoning,
        autonomyMode: payload.autonomyMode
      };

      return {
        loadedSessions: {
          ...state.loadedSessions,
          [payload.sessionId]: nextSession
        },
        sessions: sortSessions([
          ...state.sessions.filter((entry) => entry.id !== payload.sessionId),
          toSummary(nextSession)
        ])
      };
    }),
  deleteSession: (sessionId, nextActiveSessionId) =>
    set((state) => {
      const nextLoadedSessions = { ...state.loadedSessions };
      const nextDrafts = { ...state.drafts };
      delete nextLoadedSessions[sessionId];
      delete nextDrafts[sessionId];

      return {
        sessions: state.sessions.filter((entry) => entry.id !== sessionId),
        loadedSessions: nextLoadedSessions,
        drafts: nextDrafts,
        activeSessionId: nextActiveSessionId
      };
    }),
  setCavemanStatus: ({ ready, message, checking = false }) =>
    set({
      cavemanReady: ready,
      cavemanMessage: message,
      cavemanChecking: checking
    })
}));
