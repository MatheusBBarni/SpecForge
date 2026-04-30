import { useCallback } from "react";

import {
  approveChatSession,
  createChatSession,
  deleteChatSession,
  loadChatSession,
  renameChatSession,
  saveChatSession,
  sendChatMessage,
  stopChatSession
} from "../lib/runtime";
import type {
  ChatContextItem,
  ChatSession,
  ChatSessionSummary
} from "../types";
import type { SettingsStoreSlice } from "./useAppStoreSlices";

interface UseChatHandlersOptions {
  activeChatSession: ChatSession | null;
  activeChatDraft: string;
  activeSessionId: string | null;
  settingsState: SettingsStoreSlice;
  upsertSession: (session: ChatSession) => void;
  setActiveSessionId: (id: string | null) => void;
  setChatDraft: (sessionId: string, value: string) => void;
  setChatContextItems: (sessionId: string, items: ChatContextItem[]) => void;
  setSessionConfig: (payload: {
    sessionId: string;
    selectedModel: ChatSession["selectedModel"];
    selectedReasoning: ChatSession["selectedReasoning"];
    autonomyMode: ChatSession["autonomyMode"];
    contextItems: ChatContextItem[];
  }) => void;
  deleteChatSessionState: (sessionId: string, nextActiveId: string | null) => void;
  setChatSessions: (sessions: ChatSessionSummary[]) => void;
  setProjectErrorMessage: (message: string) => void;
}

export function useChatHandlers({
  activeChatSession,
  activeChatDraft,
  activeSessionId,
  settingsState: _settingsState,
  upsertSession,
  setActiveSessionId,
  setChatDraft,
  setChatContextItems,
  setSessionConfig,
  deleteChatSessionState,
  setChatSessions,
  setProjectErrorMessage
}: UseChatHandlersOptions) {
  const persistChatSession = useCallback(
    async (payload: {
      sessionId: string;
      selectedModel: ChatSession["selectedModel"];
      selectedReasoning: ChatSession["selectedReasoning"];
      autonomyMode: ChatSession["autonomyMode"];
      contextItems: ChatContextItem[];
    }) => {
      const nextSession = await saveChatSession(payload);
      upsertSession(nextSession);
      return nextSession;
    },
    [upsertSession]
  );

  const handleCreateChatSessionClick = useCallback(async () => {
    try {
      const nextSession = await createChatSession();
      upsertSession(nextSession);
      setActiveSessionId(nextSession.id);
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to create a new chat topic."
      );
    }
  }, [setActiveSessionId, setProjectErrorMessage, upsertSession]);

  const handleSelectChatSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
    },
    [setActiveSessionId]
  );

  const handleRenameChatSession = useCallback(
    async (sessionId: string, title: string) => {
      try {
        await renameChatSession({ sessionId, title });
        const nextSession = await loadChatSession(sessionId);
        upsertSession(nextSession);
      } catch (error) {
        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to rename the selected chat topic."
        );
      }
    },
    [setProjectErrorMessage, upsertSession]
  );

  const handleDeleteChatSession = useCallback(
    async (sessionId: string) => {
      try {
        const nextIndex = await deleteChatSession(sessionId);
        deleteChatSessionState(sessionId, nextIndex.lastActiveSessionId);
        setChatSessions(nextIndex.sessions);

        if (nextIndex.lastActiveSessionId) {
          setActiveSessionId(nextIndex.lastActiveSessionId);
        }
      } catch (error) {
        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to delete the selected chat topic."
        );
      }
    },
    [deleteChatSessionState, setActiveSessionId, setChatSessions, setProjectErrorMessage]
  );

  const handleChatDraftChange = useCallback(
    (value: string) => {
      if (!activeSessionId) {
        return;
      }

      setChatDraft(activeSessionId, value);
    },
    [activeSessionId, setChatDraft]
  );

  const handleSendChatMessage = useCallback(async () => {
    if (!activeChatSession || !activeChatDraft.trim()) {
      return;
    }

    try {
      await sendChatMessage({
        sessionId: activeChatSession.id,
        message: activeChatDraft
      });
      setChatDraft(activeChatSession.id, "");
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to send the current chat message."
      );
    }
  }, [activeChatDraft, activeChatSession, setChatDraft, setProjectErrorMessage]);

  const handleApproveChatSession = useCallback(async () => {
    if (!activeChatSession) {
      return;
    }

    try {
      await approveChatSession(activeChatSession.id);
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to approve the active chat topic."
      );
    }
  }, [activeChatSession, setProjectErrorMessage]);

  const handleStopChatSession = useCallback(async () => {
    if (!activeChatSession) {
      return;
    }

    try {
      await stopChatSession(activeChatSession.id);
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to stop the active chat topic."
      );
    }
  }, [activeChatSession, setProjectErrorMessage]);

  const handleSaveChatSessionConfig = useCallback(
    async (payload: {
      sessionId: string;
      selectedModel: ChatSession["selectedModel"];
      selectedReasoning: ChatSession["selectedReasoning"];
      autonomyMode: ChatSession["autonomyMode"];
      contextItems: ChatContextItem[];
    }) => {
      setSessionConfig(payload);
      setChatContextItems(payload.sessionId, payload.contextItems);

      try {
        await persistChatSession(payload);
      } catch (error) {
        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to save the current chat topic."
        );
      }
    },
    [persistChatSession, setChatContextItems, setProjectErrorMessage, setSessionConfig]
  );

  const handleAttachChatFile = useCallback(
    (path: string) => {
      if (!activeChatSession) {
        return;
      }

      if (activeChatSession.contextItems.some((item) => item.path === path)) {
        return;
      }

      const nextContextItems = [
        ...activeChatSession.contextItems,
        {
          id: `file-${Date.now().toString(36)}`,
          kind: "file" as const,
          label: path.split("/").pop() ?? path,
          path,
          isDefault: false
        }
      ];

      void handleSaveChatSessionConfig({
        sessionId: activeChatSession.id,
        selectedModel: activeChatSession.selectedModel,
        selectedReasoning: activeChatSession.selectedReasoning,
        autonomyMode: activeChatSession.autonomyMode,
        contextItems: nextContextItems
      });
    },
    [activeChatSession, handleSaveChatSessionConfig]
  );

  const handleRemoveChatContextItem = useCallback(
    (itemId: string) => {
      if (!activeChatSession) {
        return;
      }

      const nextContextItems = activeChatSession.contextItems.filter(
        (item) => item.id !== itemId
      );

      void handleSaveChatSessionConfig({
        sessionId: activeChatSession.id,
        selectedModel: activeChatSession.selectedModel,
        selectedReasoning: activeChatSession.selectedReasoning,
        autonomyMode: activeChatSession.autonomyMode,
        contextItems: nextContextItems
      });
    },
    [activeChatSession, handleSaveChatSessionConfig]
  );

  return {
    persistChatSession,
    handleCreateChatSessionClick,
    handleSelectChatSession,
    handleRenameChatSession,
    handleDeleteChatSession,
    handleChatDraftChange,
    handleSendChatMessage,
    handleApproveChatSession,
    handleStopChatSession,
    handleSaveChatSessionConfig,
    handleAttachChatFile,
    handleRemoveChatContextItem
  };
}
