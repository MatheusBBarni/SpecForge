import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction
} from "react";

import { clearFallbackTimer } from "../lib/appShell";
import {
  loadProjectContext,
  subscribeToAgentEvents
} from "../lib/runtime";
import type {
  AgentEventPayload,
  EnvironmentStatus,
  ProjectContext
} from "../types";

export function useSystemThemePreference(
  setSystemPrefersDark: (nextValue: boolean) => void
) {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mediaQuery.matches);
    const handleThemeChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, [setSystemPrefersDark]);
}

export function useDocumentTheme(resolvedTheme: string) {
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dracula");
  }, [resolvedTheme]);
}

interface WorkspaceSearchShortcutsOptions {
  closeWorkspaceSearch: () => void;
  isReviewRoute: boolean;
  isSearchOpen: boolean;
  setCommandSearch: Dispatch<SetStateAction<string>>;
  setIsSearchOpen: Dispatch<SetStateAction<boolean>>;
}

export function useWorkspaceSearchShortcuts({
  closeWorkspaceSearch,
  isReviewRoute,
  isSearchOpen,
  setCommandSearch,
  setIsSearchOpen
}: WorkspaceSearchShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const isFindShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "f";

      if (isFindShortcut) {
        if (!isReviewRoute) {
          return;
        }

        event.preventDefault();
        setIsSearchOpen((currentValue) => {
          if (currentValue) {
            setCommandSearch("");
            return false;
          }

          return true;
        });
        return;
      }

      if (event.key === "Escape" && isSearchOpen) {
        event.preventDefault();
        closeWorkspaceSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeWorkspaceSearch,
    isReviewRoute,
    isSearchOpen,
    setCommandSearch,
    setIsSearchOpen
  ]);
}

interface WorkspaceSearchRouteResetOptions {
  closeWorkspaceSearch: () => void;
  isReviewRoute: boolean;
  isSearchOpen: boolean;
}

export function useWorkspaceSearchRouteReset({
  closeWorkspaceSearch,
  isReviewRoute,
  isSearchOpen
}: WorkspaceSearchRouteResetOptions) {
  useEffect(() => {
    if (!isReviewRoute && isSearchOpen) {
      closeWorkspaceSearch();
    }
  }, [closeWorkspaceSearch, isReviewRoute, isSearchOpen]);
}

interface WorkspaceSearchFocusOptions {
  isReviewRoute: boolean;
  isSearchOpen: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export function useWorkspaceSearchFocus({
  isReviewRoute,
  isSearchOpen,
  searchInputRef
}: WorkspaceSearchFocusOptions) {
  useEffect(() => {
    if (!isSearchOpen || !isReviewRoute) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [isReviewRoute, isSearchOpen, searchInputRef]);
}

interface InitialDiagnosticsOptions {
  environment: EnvironmentStatus;
  hasScannedEnvironmentRef: MutableRefObject<boolean>;
  refreshDiagnostics: (previousEnvironment?: EnvironmentStatus) => Promise<void>;
}

export function useInitialDiagnostics({
  environment,
  hasScannedEnvironmentRef,
  refreshDiagnostics
}: InitialDiagnosticsOptions) {
  useEffect(() => {
    if (hasScannedEnvironmentRef.current) {
      return;
    }

    hasScannedEnvironmentRef.current = true;
    void refreshDiagnostics(environment);
  }, [environment, hasScannedEnvironmentRef, refreshDiagnostics]);
}

interface ProjectRestoreOptions {
  applyProjectContext: (
    context: ProjectContext,
    options?: { navigateToChat?: boolean }
  ) => void;
  desktopRuntime: boolean;
  hasAttemptedProjectRestore: boolean;
  lastProjectPath: string;
  setHasAttemptedProjectRestore: (nextValue: boolean) => void;
  setIsProjectLoading: (nextValue: boolean) => void;
  setLastProjectPath: (path: string) => void;
}

export function useProjectRestore({
  applyProjectContext,
  desktopRuntime,
  hasAttemptedProjectRestore,
  lastProjectPath,
  setHasAttemptedProjectRestore,
  setIsProjectLoading,
  setLastProjectPath
}: ProjectRestoreOptions) {
  useEffect(() => {
    if (hasAttemptedProjectRestore || !desktopRuntime) {
      return;
    }

    if (!lastProjectPath.trim()) {
      setHasAttemptedProjectRestore(true);
      return;
    }

    let isDisposed = false;
    setIsProjectLoading(true);

    void loadProjectContext(lastProjectPath)
      .then((context) => {
        if (isDisposed) {
          return;
        }

        applyProjectContext(context, {
          navigateToChat: context.hasSavedSettings
        });
      })
      .catch(() => {
        if (isDisposed) {
          return;
        }

        setLastProjectPath("");
      })
      .finally(() => {
        if (isDisposed) {
          return;
        }

        setIsProjectLoading(false);
        setHasAttemptedProjectRestore(true);
      });

    return () => {
      isDisposed = true;
    };
  }, [
    applyProjectContext,
    desktopRuntime,
    hasAttemptedProjectRestore,
    lastProjectPath,
    setHasAttemptedProjectRestore,
    setIsProjectLoading,
    setLastProjectPath
  ]);
}

interface AgentEventSubscriptionOptions {
  appendTerminalOutput: (line: string) => void;
  applyAgentEvent: (payload: AgentEventPayload) => void;
  fallbackTimerRef: MutableRefObject<number | null>;
  projectSaveTimerRef: MutableRefObject<number | null>;
  setLatestDiff: Dispatch<SetStateAction<string>>;
}

export function useAgentEventSubscription({
  appendTerminalOutput,
  applyAgentEvent,
  fallbackTimerRef,
  projectSaveTimerRef,
  setLatestDiff
}: AgentEventSubscriptionOptions) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isDisposed = false;

    void subscribeToAgentEvents({
      onLine: appendTerminalOutput,
      onState: (payload) => {
        applyAgentEvent(payload);
        if (payload.pendingDiff) {
          setLatestDiff(payload.pendingDiff);
        }
      }
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      isDisposed = true;
      unlisten?.();
      clearFallbackTimer(fallbackTimerRef);

      if (projectSaveTimerRef.current !== null) {
        window.clearTimeout(projectSaveTimerRef.current);
        projectSaveTimerRef.current = null;
      }
    };
  }, [
    appendTerminalOutput,
    applyAgentEvent,
    fallbackTimerRef,
    projectSaveTimerRef,
    setLatestDiff
  ]);
}
