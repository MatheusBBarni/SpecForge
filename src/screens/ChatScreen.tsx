import {
  Button,
  Card,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownTrigger,
  Input,
  TextArea
} from "@heroui/react";
import {
  Attachment,
  BubbleSearch,
  ChatBubble,
  CheckCircle,
  Code,
  Copy,
  EditPencil,
  Refresh,
  SendSolid,
  Terminal,
  ThreePointsCircle,
  Trash,
  WarningCircle,
  Xmark,
  XmarkCircle
} from "iconoir-react";
import {
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { ModelReasoningDropdown } from "../components/ModelReasoningDropdown";
import { INPUT_CLASS } from "../components/SettingsPrimitives";
import { getModelOptions, getReasoningOptions } from "../lib/agentConfig";
import { isOpenableWorkspacePath } from "../lib/appShell";
import type {
  AutonomyMode,
  ChatContextItem,
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  CursorModel,
  ModelProvider,
  WorkspaceEntry
} from "../types";

interface ChatScreenProps {
  workspaceRootName: string;
  sessions: ChatSessionSummary[];
  activeSession: ChatSession | null;
  activeDraft: string;
  workspaceEntries: WorkspaceEntry[];
  configuredModelProviders: ModelProvider[];
  cursorModels: CursorModel[];
  cavemanReady: boolean;
  cavemanMessage: string;
  cavemanChecking: boolean;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDraftChange: (value: string) => void;
  onRefresh: () => void;
  onRemoveContextItem: (itemId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onSaveSessionConfig: (payload: {
    sessionId: string;
    selectedModel: ChatSession["selectedModel"];
    selectedReasoning: ChatSession["selectedReasoning"];
    autonomyMode: AutonomyMode;
    contextItems: ChatContextItem[];
  }) => void;
  onSelectSession: (sessionId: string) => void;
  onSend: () => void;
  onStop: () => void;
  onApprove: () => void;
  onAttachFile: (path: string) => void;
  onOpenReview: () => void;
}

const CORE_BORDER = "border-[var(--border-strong)]";
const TOP_BAR_CLASS = `flex min-h-[70px] items-center border-b ${CORE_BORDER} bg-[var(--bg-panel)] px-5`;
const ICON_BUTTON_CLASS =
  "grid size-10 shrink-0 place-items-center rounded border border-[var(--border-soft)] bg-transparent p-0 text-[var(--text-subtle)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]";
const TEXT_BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]";
const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--bg-app)] transition hover:bg-[#d7baff]";
const DANGER_BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[rgba(255,85,85,0.38)] bg-[rgba(255,85,85,0.12)] px-3 text-sm font-semibold text-[var(--danger)] transition hover:bg-[rgba(255,85,85,0.18)]";
const MENU_POPOVER_CLASS =
  "min-w-52 rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)]";
const MENU_ITEM_CLASS =
  "cursor-pointer rounded px-3 py-2 text-sm text-[var(--text-main)] outline-none transition data-[focused=true]:bg-white/8";
const MENU_DANGER_ITEM_CLASS =
  "cursor-pointer rounded px-3 py-2 text-sm text-[var(--danger)] outline-none transition data-[focused=true]:bg-[rgba(255,85,85,0.14)]";

export const ChatScreen = memo(function ChatScreen({
  workspaceRootName,
  sessions,
  activeSession,
  activeDraft,
  workspaceEntries,
  configuredModelProviders,
  cursorModels,
  cavemanReady,
  cavemanMessage,
  cavemanChecking,
  onCreateSession,
  onDeleteSession,
  onDraftChange,
  onRefresh,
  onRemoveContextItem,
  onRenameSession,
  onSaveSessionConfig,
  onSelectSession,
  onSend,
  onStop,
  onApprove,
  onAttachFile,
  onOpenReview
}: ChatScreenProps) {
  const [sessionSearch, setSessionSearch] = useState("");
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);

  const mentionQuery = useMemo(() => {
    const match = activeDraft.match(/(?:^|\s)@([^\s@]*)$/);
    return match?.[1]?.toLowerCase() ?? "";
  }, [activeDraft]);

  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) =>
        `${session.title} ${session.lastMessagePreview}`
          .toLowerCase()
          .includes(sessionSearch.trim().toLowerCase())
      ),
    [sessions, sessionSearch]
  );

  const attachableFiles = useMemo(
    () =>
      workspaceEntries.filter(
        (entry) =>
          entry.kind === "file" &&
          isOpenableWorkspacePath(entry.path) &&
          `${entry.name} ${entry.path}`
            .toLowerCase()
            .includes(mentionQuery.trim().toLowerCase())
      ),
    [mentionQuery, workspaceEntries]
  );

  const canSend = Boolean(
    activeSession &&
      activeDraft.trim() &&
      !activeSession.runtime.isBusy
  );

  const modelOptions = useMemo(
    () =>
      getModelOptions(
        configuredModelProviders.length === 1
          ? configuredModelProviders[0]
          : undefined,
        cursorModels
      ),
    [configuredModelProviders, cursorModels]
  );

  const reasoningOptions = useMemo(
    () =>
      activeSession
        ? getReasoningOptions(activeSession.selectedModel, cursorModels)
        : [],
    [activeSession, cursorModels]
  );

  const handleRenameRequest = useCallback(
    (session: ChatSessionSummary) => {
      const nextTitle = window.prompt("Rename session", session.title)?.trim();

      if (nextTitle) {
        onRenameSession(session.id, nextTitle);
      }
    },
    [onRenameSession]
  );

  useEffect(() => {
    if (mentionQuery.length === 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      draftInputRef.current?.focus({ preventScroll: true });
    });
  }, [mentionQuery]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-panel)]">
      <header className={TOP_BAR_CLASS}>
        <div className="relative w-full max-w-[320px]">
          <BubbleSearch className="-translate-y-1/2 pointer-events-none absolute left-3 top-1/2 size-5 text-[var(--text-muted)]" />
          <Input
            aria-label="Search workspace sessions"
            className={`${INPUT_CLASS} h-10 rounded pl-10`}
            onChange={(event) => setSessionSearch(event.target.value)}
            placeholder="Search workspace..."
            value={sessionSearch}
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`min-h-0 border-r ${CORE_BORDER} bg-[var(--bg-panel)]`}>
          <div className={`flex h-20 items-center justify-between border-b ${CORE_BORDER} px-5`}>
            <h1 className="m-0 text-xl font-semibold text-[var(--text-main)]">
              Active Sessions
            </h1>
            <Button
              aria-label="Create new session"
              className="grid size-9 place-items-center rounded bg-transparent p-0 text-[var(--accent)] transition hover:bg-white/8"
              onPress={onCreateSession}
            >
              <span className="text-2xl leading-none">+</span>
            </Button>
          </div>

          <div className="min-h-0 overflow-auto px-3 py-3">
            {visibleSessions.map((session) => {
              const isActive = session.id === activeSession?.id;

              return (
                <article
                  className={`group border-l-4 px-3 py-3 transition ${
                    isActive
                      ? "border-[var(--accent)] bg-white/[0.06]"
                      : "border-transparent hover:bg-white/[0.04]"
                  }`}
                  key={session.id}
                >
                  <div className="flex items-start gap-2">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelectSession(session.id)}
                      type="button"
                    >
                      <div className="flex min-w-0 items-baseline justify-between gap-3">
                        <h2
                          className={`m-0 truncate text-sm font-semibold ${
                            isActive
                              ? "text-[var(--accent)]"
                              : "text-[var(--text-main)]"
                          }`}
                        >
                          {session.title}
                        </h2>
                        <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                          {formatRelativeTime(session.updatedAt)}
                        </span>
                      </div>
                      <p className="mb-0 mt-2 line-clamp-2 text-sm leading-5 text-[var(--text-subtle)]">
                        {session.lastMessagePreview || "No messages yet."}
                      </p>
                    </button>

                    <DropdownRoot>
                      <DropdownTrigger>
                        <Button
                          aria-label={`Actions for ${session.title}`}
                          className="grid size-8 shrink-0 place-items-center rounded bg-transparent p-0 text-[var(--text-muted)] opacity-0 transition hover:bg-white/8 hover:text-[var(--text-main)] group-hover:opacity-100"
                        >
                          <ThreePointsCircle className="size-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownPopover className={MENU_POPOVER_CLASS}>
                        <DropdownMenu
                          aria-label={`Actions for ${session.title}`}
                          onAction={(key) => {
                            if (key === "rename") {
                              handleRenameRequest(session);
                              return;
                            }

                            if (key === "delete") {
                              onDeleteSession(session.id);
                            }
                          }}
                        >
                          <DropdownItem className={MENU_ITEM_CLASS} id="rename">
                            <div className="flex items-center gap-2">
                              <EditPencil className="size-4" />
                              Rename
                            </div>
                          </DropdownItem>
                          <DropdownItem className={MENU_DANGER_ITEM_CLASS} id="delete">
                            <div className="flex items-center gap-2">
                              <Trash className="size-4" />
                              Delete Session
                            </div>
                          </DropdownItem>
                        </DropdownMenu>
                      </DropdownPopover>
                    </DropdownRoot>
                  </div>
                </article>
              );
            })}

            {visibleSessions.length === 0 ? (
              <div className="grid min-h-40 place-items-center px-4 text-center text-sm leading-6 text-[var(--text-subtle)]">
                No sessions match your search.
              </div>
            ) : null}
          </div>
        </aside>

        <main className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[var(--bg-panel)]">
          <div className="min-h-0 overflow-auto px-5 py-10 lg:px-8">
            <div className="mx-auto flex max-w-[920px] flex-col gap-7">
              <DateDivider />

              {!cavemanReady ? (
                <Card className="border border-[rgba(255,184,108,0.25)] bg-[rgba(255,184,108,0.12)] shadow-none">
                  <Card.Content className="flex items-start gap-3 px-4 py-3 text-sm text-[var(--text-main)]">
                    <WarningCircle className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
                    <div>{cavemanChecking ? "Verifying Caveman skill..." : cavemanMessage}</div>
                  </Card.Content>
                </Card>
              ) : null}

              <ConversationMessages
                activeSession={activeSession}
                workspaceRootName={workspaceRootName}
              />
            </div>
          </div>

          <footer className={`border-t ${CORE_BORDER} bg-[var(--bg-panel)] px-5 py-5 lg:px-6`}>
            <div className="mx-auto max-w-[960px]">
              <div className="relative rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)]">
                <MentionSuggestionsPanel
                  activeDraft={activeDraft}
                  attachableFiles={attachableFiles}
                  isOpen={mentionQuery.length > 0}
                  onAttachFile={onAttachFile}
                  onDraftChange={onDraftChange}
                />
                <TextArea
                  aria-label="Chat message draft"
                  className="min-h-24 w-full resize-none border-0 bg-transparent px-5 py-5 text-base leading-7 text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
                  onChange={(event) => onDraftChange(event.target.value)}
                  placeholder="Message SpecForge or type '/' for commands..."
                  ref={draftInputRef}
                  value={activeDraft}
                />

                {activeSession?.contextItems.length ? (
                  <ContextChips
                    items={activeSession.contextItems}
                    onRemoveContextItem={onRemoveContextItem}
                  />
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] px-4 py-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Button
                      aria-label="Attach file with @ mention"
                      className={ICON_BUTTON_CLASS}
                      onPress={() =>
                        onDraftChange(
                          `${activeDraft}${activeDraft.endsWith(" ") || activeDraft.length === 0 ? "" : " "}@`
                        )
                      }
                    >
                      <Attachment className="size-4" />
                    </Button>
                    <Button
                      aria-label="Open review"
                      className={ICON_BUTTON_CLASS}
                      onPress={onOpenReview}
                    >
                      <Code className="size-4" />
                    </Button>
                    <span className="hidden h-6 w-px bg-[var(--border-soft)] sm:block" />
                    <span className="truncate">
                      Context: {activeSession?.contextItems[0]?.path ?? workspaceRootName}
                    </span>
                    {activeSession ? (
                      <ChatConfigControls
                        activeSession={activeSession}
                        cursorModels={cursorModels}
                        modelOptions={modelOptions}
                        onSaveSessionConfig={onSaveSessionConfig}
                        reasoningOptions={reasoningOptions}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      aria-label="Refresh chat runtime"
                      className={ICON_BUTTON_CLASS}
                      onPress={onRefresh}
                    >
                      <Refresh className="size-4" />
                    </Button>
                    {activeSession?.runtime.awaitingApproval ? (
                      <Button className={TEXT_BUTTON_CLASS} onPress={onApprove}>
                        <CheckCircle className="size-4" />
                        Approve
                      </Button>
                    ) : null}
                    {activeSession?.runtime.isBusy ? (
                      <Button className={DANGER_BUTTON_CLASS} onPress={onStop}>
                        <XmarkCircle className="size-4" />
                        Stop
                      </Button>
                    ) : null}
                    <Button
                      aria-label="Send message"
                      className={PRIMARY_BUTTON_CLASS}
                      isDisabled={!canSend}
                      onPress={onSend}
                    >
                      Send
                      <SendSolid className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="mb-0 mt-3 text-center font-[var(--font-mono)] text-[11px] text-[var(--text-muted)]">
                SpecForge can make mistakes. Consider verifying critical code.
              </p>
            </div>
          </footer>
        </main>
      </div>
    </section>
  );
});

function MessageBlock({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-5">
        <div>
          <div className="rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-5 py-4 text-base leading-7 text-[var(--text-main)]">
            <MessageContent content={message.content} />
          </div>
          <div className="mt-2 text-right font-[var(--font-mono)] text-[11px] text-[var(--text-muted)]">
            {formatMessageTime(message.createdAt)}
          </div>
        </div>
        <Avatar label="You" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-5">
      <div className="grid size-10 place-items-center rounded border border-[var(--accent)] bg-[rgba(189,147,249,0.18)] text-[var(--accent)]">
        <Terminal className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-semibold text-[var(--accent)]">SpecForge Agent</span>
          <span className="font-[var(--font-mono)] text-[11px] text-[var(--text-muted)]">
            {formatMessageTime(message.createdAt)}
          </span>
        </div>
        <div className="text-base leading-7 text-[var(--text-main)]">
          <MessageContent content={message.content} />
        </div>
      </div>
    </div>
  );
}

function ConversationMessages({
  activeSession,
  workspaceRootName
}: {
  activeSession: ChatSession | null;
  workspaceRootName: string;
}) {
  if (!activeSession || activeSession.messages.length === 0) {
    return <EmptyConversation workspaceRootName={workspaceRootName} />;
  }

  return activeSession.messages.map((message) => (
    <MessageBlock key={message.id} message={message} />
  ));
}

function MessageContent({ content }: { content: string }) {
  const parts = parseCodeBlocks(content);

  return (
    <>
      {parts.map((part) =>
        part.kind === "code" ? (
          <CodeBlock
            code={part.content}
            key={part.id}
            language={part.language}
          />
        ) : (
          <p
            className="my-0 whitespace-pre-wrap text-base leading-7"
            key={part.id}
          >
            {part.content}
          </p>
        )
      )}
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="my-5 overflow-hidden rounded border border-[var(--border-soft)] bg-[var(--bg-surface)]">
      <div className="flex min-h-12 items-center justify-between border-b border-[var(--border-soft)] px-4 font-[var(--font-mono)] text-xs text-[var(--text-muted)]">
        <span>{language || "code"}</span>
        <Copy className="size-4" />
      </div>
      <pre className="m-0 overflow-auto p-5 font-[var(--font-mono)] text-sm leading-7 text-[var(--text-main)]">
        <code>{code.trimEnd()}</code>
      </pre>
    </div>
  );
}

function EmptyConversation({ workspaceRootName }: { workspaceRootName: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded border border-dashed border-[var(--border-soft)] px-8 text-center">
      <div className="max-w-md">
        <ChatBubble className="mx-auto size-9 text-[var(--accent)]" />
        <h2 className="mb-0 mt-4 text-xl font-semibold text-[var(--text-main)]">
          Start a SpecForge session
        </h2>
        <p className="mb-0 mt-3 text-sm leading-6 text-[var(--text-subtle)]">
          PRD, SPEC, supporting docs, and the {workspaceRootName} workspace tree are
          available as context for the first turn.
        </p>
      </div>
    </div>
  );
}

function DateDivider() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <div className="h-px bg-[var(--border-soft)]" />
      <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Today
      </span>
      <div className="h-px bg-[var(--border-soft)]" />
    </div>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <div
      className="grid size-10 place-items-center rounded border border-[var(--border-soft)] bg-[linear-gradient(135deg,rgba(80,250,123,0.2),rgba(139,233,253,0.18))] text-sm font-bold text-[var(--text-main)]"
      title={label}
    >
      {label.slice(0, 1)}
    </div>
  );
}

function ContextChips({
  items,
  onRemoveContextItem
}: {
  items: ChatContextItem[];
  onRemoveContextItem: (itemId: string) => void;
}) {
  return (
    <div className="flex min-h-11 flex-wrap gap-2 border-t border-[var(--border-soft)] px-4 py-2">
      {items.map((item) => (
        <Button
          aria-label={`Remove ${item.label} from chat context`}
          className="group min-h-7 rounded border border-[var(--border-soft)] bg-white/[0.04] px-2 text-xs text-[var(--text-subtle)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          key={item.id}
          onPress={() => onRemoveContextItem(item.id)}
        >
          <span className="max-w-52 truncate">{item.label}</span>
          <Xmark className="hidden size-3.5 group-hover:block" />
        </Button>
      ))}
    </div>
  );
}

function MentionSuggestionsPanel({
  activeDraft,
  attachableFiles,
  isOpen,
  onAttachFile,
  onDraftChange
}: {
  activeDraft: string;
  attachableFiles: WorkspaceEntry[];
  isOpen: boolean;
  onAttachFile: (path: string) => void;
  onDraftChange: (value: string) => void;
}) {
  const handleAttachRequest = useCallback(
    (path: string, event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onAttachFile(path);
      onDraftChange(removeTrailingMention(activeDraft));
    },
    [activeDraft, onAttachFile, onDraftChange]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 max-h-48 w-[min(34rem,100%)] overflow-auto rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)]">
      {attachableFiles.length > 0 ? (
        attachableFiles.slice(0, 8).map((entry) => (
          <button
            className="flex w-full min-w-0 items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--text-main)] outline-none transition hover:bg-[var(--accent)] hover:text-[var(--bg-app)]"
            key={entry.path}
            onClick={(event) => handleAttachRequest(entry.path, event)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            <Attachment className="size-4 shrink-0" />
            <span className="truncate">{entry.path}</span>
          </button>
        ))
      ) : (
        <div className="rounded px-3 py-2 text-sm text-[var(--text-subtle)]">
          No matching files.
        </div>
      )}
    </div>
  );
}

function ChatConfigControls({
  activeSession,
  cursorModels,
  modelOptions,
  onSaveSessionConfig,
  reasoningOptions
}: {
  activeSession: ChatSession;
  cursorModels: CursorModel[];
  modelOptions: Array<{ value: ChatSession["selectedModel"]; label: string; hint?: string }>;
  onSaveSessionConfig: ChatScreenProps["onSaveSessionConfig"];
  reasoningOptions: Array<{
    value: ChatSession["selectedReasoning"];
    label: string;
    hint?: string;
  }>;
}) {
  return (
    <ModelReasoningDropdown
      cursorModels={cursorModels}
      modelOptions={modelOptions}
      onChange={({ selectedModel, selectedReasoning }) => {
      onSaveSessionConfig({
        sessionId: activeSession.id,
        selectedModel,
        selectedReasoning,
        autonomyMode: activeSession.autonomyMode,
        contextItems: activeSession.contextItems
      });
      }}
      reasoningOptions={reasoningOptions}
      selectedModel={activeSession.selectedModel}
      selectedReasoning={activeSession.selectedReasoning}
    />
  );
}

function removeTrailingMention(value: string) {
  return value.replace(/(?:^|\s)@[^\s@]*$/, "").trimEnd();
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays === 1) {
    return "Yesterday";
  }

  return `${diffDays}d ago`;
}

function formatMessageTime(value: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

function parseCodeBlocks(content: string) {
  const blocks: Array<{
    id: string;
    kind: "text" | "code";
    content: string;
    language: string;
  }> = [];
  const matcher = /```(\w+)?\n([\s\S]*?)```/g;
  let cursor = 0;
  let match = matcher.exec(content);

  while (match !== null) {
    if (match.index > cursor) {
      const text = content.slice(cursor, match.index).trim();

      blocks.push({
        id: `text-${cursor}-${text.length}`,
        kind: "text",
        content: text,
        language: ""
      });
    }

    blocks.push({
      id: `code-${match.index}-${matcher.lastIndex}`,
      kind: "code",
      content: match[2] ?? "",
      language: match[1] ?? ""
    });
    cursor = matcher.lastIndex;
    match = matcher.exec(content);
  }

  if (cursor < content.length) {
    const text = content.slice(cursor).trim();

    blocks.push({
      id: `text-${cursor}-${text.length}`,
      kind: "text",
      content: text,
      language: ""
    });
  }

  return blocks.filter((block) => block.content.length > 0);
}
