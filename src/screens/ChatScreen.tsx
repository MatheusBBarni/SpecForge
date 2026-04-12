import {
  Button,
  Card,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownTrigger,
  Input,
  Label,
  ListBox,
  Select,
  TextArea
} from "@heroui/react";
import {
  ArrowRight,
  Attachment,
  ChatBubble,
  ChatLines,
  CheckCircle,
  EditPencil,
  Refresh,
  SendSolid,
  Settings,
  ThreePointsCircle,
  Trash,
  WarningCircle,
  XmarkCircle
} from "iconoir-react";
import { useCallback, useMemo, useState, type Key } from "react";

import { DiffPreview } from "../components/DiffPreview";
import {
  FIELD_LABEL_CLASS,
  INPUT_CLASS,
  LISTBOX_ITEM_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SELECT_TRIGGER_CLASS,
  SETTINGS_PANEL_CLASS,
  TEXTAREA_CLASS
} from "../components/SettingsPrimitives";
import { getModelOptions, getReasoningOptions } from "../lib/agentConfig";
import { isOpenableWorkspacePath } from "../lib/appShell";
import type {
  AutonomyMode,
  ChatContextItem,
  ChatSession,
  ChatSessionSummary,
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

const AUTONOMY_OPTIONS: AutonomyMode[] = ["stepped", "milestone", "god_mode"];

const PANEL_CLASS = `${SETTINGS_PANEL_CLASS} rounded-[1.5rem]`;
const PANEL_CONTENT_CLASS = "flex min-h-0 flex-1 flex-col gap-4 px-5 py-5";
const EYEBROW_CLASS =
  "m-0 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]";
const PANEL_TITLE_CLASS = "m-0 text-lg font-semibold text-[var(--text-main)]";
const ICON_BUTTON_CLASS =
  "inline-flex min-h-[3rem] min-w-[3rem] items-center justify-center rounded-[1rem] border border-[var(--border-soft)] bg-white/5 px-0 font-medium text-[var(--text-main)] transition hover:-translate-y-0.5 hover:bg-white/8";
const TOPIC_CARD_CLASS =
  "border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-none transition";
const TOPIC_CARD_ACTIVE_CLASS = "border-[var(--accent)] bg-white/10";
const TOPIC_SELECT_BUTTON_CLASS =
  "flex min-w-0 items-start justify-start rounded-[0.95rem] px-3 py-3 text-left transition hover:bg-white/[0.06]";
const TOPIC_MENU_BUTTON_CLASS =
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-[0.95rem] border border-[var(--border-soft)] bg-[rgba(255,184,108,0.08)] px-0 text-[var(--text-main)] transition hover:bg-[rgba(255,184,108,0.14)]";
const TOPIC_MENU_POPOVER_CLASS =
  "min-w-56 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)] backdrop-blur-xl";
const TOPIC_MENU_ITEM_CLASS =
  "cursor-pointer rounded-[0.9rem] px-3 py-3 text-[var(--text-main)] outline-none transition data-[focused=true]:bg-white/8";
const TOPIC_MENU_DANGER_ITEM_CLASS =
  "cursor-pointer rounded-[0.9rem] px-3 py-3 text-[var(--danger)] outline-none transition data-[focused=true]:bg-[rgba(255,85,85,0.14)]";
const STATUS_BADGE_CLASS =
  "shrink-0 rounded-full border border-[var(--border-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]";
const WARNING_CARD_CLASS =
  "border border-[rgba(255,184,108,0.25)] bg-[rgba(255,184,108,0.12)] shadow-none";
const EMPTY_STATE_CARD_CLASS =
  "border border-dashed border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-none";
const ATTACH_CARD_CLASS =
  "border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-none";
const LIST_ITEM_BUTTON_CLASS =
  "flex w-full items-center justify-start gap-2 rounded-[0.9rem] px-3 py-2 text-left text-sm text-[var(--text-main)] transition hover:bg-white/8";
const CONTEXT_CHIP_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/[0.06] px-3 py-2 text-xs font-medium text-[var(--text-main)] transition hover:bg-white/[0.1]";
const TERMINAL_CARD_CLASS =
  "min-h-0 flex-1 border border-[var(--border-soft)] bg-black/20 shadow-none";

export function ChatScreen({
  workspaceRootName,
  sessions,
  activeSession,
  activeDraft,
  workspaceEntries,
  configuredModelProviders,
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
  const [topicSearch, setTopicSearch] = useState("");
  const [contextSearch, setContextSearch] = useState("");

  const mentionQuery = useMemo(() => {
    const match = activeDraft.match(/(?:^|\s)@([^\s@]*)$/);
    return match?.[1]?.toLowerCase() ?? "";
  }, [activeDraft]);

  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) =>
        `${session.title} ${session.lastMessagePreview}`
          .toLowerCase()
          .includes(topicSearch.trim().toLowerCase())
      ),
    [sessions, topicSearch]
  );

  const attachableFiles = useMemo(
    () =>
      workspaceEntries.filter(
        (entry) =>
          entry.kind === "file" &&
          isOpenableWorkspacePath(entry.path) &&
          `${entry.name} ${entry.path}`
            .toLowerCase()
            .includes((mentionQuery || contextSearch).trim().toLowerCase())
      ),
    [contextSearch, mentionQuery, workspaceEntries]
  );

  const canSend = Boolean(
    activeSession &&
      activeDraft.trim() &&
      cavemanReady &&
      !activeSession.runtime.isBusy
  );

  const handleRenameRequest = useCallback(
    (session: ChatSessionSummary) => {
      const nextTitle = window.prompt("Rename topic", session.title)?.trim();

      if (nextTitle) {
        onRenameSession(session.id, nextTitle);
      }
    },
    [onRenameSession]
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4 lg:px-5 lg:pb-5">
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <Card className={PANEL_CLASS}>
          <Card.Content className={PANEL_CONTENT_CLASS}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={EYEBROW_CLASS}>Topics</p>
                <h1 className={PANEL_TITLE_CLASS}>{workspaceRootName}</h1>
              </div>
              <Button className={PRIMARY_BUTTON_CLASS} onPress={onCreateSession}>
                <ChatBubble className="size-4" />
                New
              </Button>
            </div>

            <Input
              className={INPUT_CLASS}
              onChange={(event) => setTopicSearch(event.target.value)}
              placeholder="Search topics"
              value={topicSearch}
            />

            <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
              {visibleSessions.map((session) => {
                const isActive = session.id === activeSession?.id;

                return (
                  <Card
                    className={`${TOPIC_CARD_CLASS} ${
                      isActive ? TOPIC_CARD_ACTIVE_CLASS : ""
                    }`}
                    key={session.id}
                  >
                    <Card.Content className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3">
                      <Button
                        className={TOPIC_SELECT_BUTTON_CLASS}
                        onPress={() => onSelectSession(session.id)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-[var(--text-main)]">
                              {session.title}
                            </span>
                            <span className={STATUS_BADGE_CLASS}>
                              {session.status.replace("_", " ")}
                            </span>
                          </div>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--text-subtle)]">
                            {session.lastMessagePreview || "No messages yet."}
                          </span>
                        </div>
                      </Button>

                      <DropdownRoot>
                        <DropdownTrigger>
                          <Button className={TOPIC_MENU_BUTTON_CLASS}>
                            <ThreePointsCircle className="size-4" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownPopover className={TOPIC_MENU_POPOVER_CLASS}>
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
                            <DropdownItem className={TOPIC_MENU_ITEM_CLASS} id="rename">
                              <div className="flex items-center gap-2">
                                <EditPencil className="size-4" />
                                Rename
                              </div>
                            </DropdownItem>
                            <DropdownItem
                              className={TOPIC_MENU_DANGER_ITEM_CLASS}
                              id="delete"
                            >
                              <div className="flex items-center gap-2">
                                <Trash className="size-4" />
                                Delete Conversation
                              </div>
                            </DropdownItem>
                          </DropdownMenu>
                        </DropdownPopover>
                      </DropdownRoot>
                    </Card.Content>
                  </Card>
                );
              })}

              {visibleSessions.length === 0 ? (
                <Card className={EMPTY_STATE_CARD_CLASS}>
                  <Card.Content className="grid min-h-40 place-items-center px-6 py-8 text-center text-sm leading-7 text-[var(--text-subtle)]">
                    No topics match your search.
                  </Card.Content>
                </Card>
              ) : null}
            </div>
          </Card.Content>
        </Card>

        <Card className={PANEL_CLASS}>
          <Card.Content className={PANEL_CONTENT_CLASS}>
            <header className="flex items-center justify-between gap-4 border-b border-[var(--border-strong)] pb-4">
              <div className="min-w-0">
                <p className={EYEBROW_CLASS}>Agent Chat</p>
                <h2 className="m-0 truncate text-xl font-semibold text-[var(--text-main)]">
                  {activeSession?.title ?? "No topic selected"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button className={SECONDARY_BUTTON_CLASS} onPress={onOpenReview}>
                  Review
                  <ArrowRight className="size-4" />
                </Button>
                <Button className={ICON_BUTTON_CLASS} onPress={onRefresh}>
                  <Refresh className="size-4" />
                </Button>
              </div>
            </header>

            {!cavemanReady ? (
              <Card className={WARNING_CARD_CLASS}>
                <Card.Content className="flex items-start gap-3 px-4 py-3 text-sm text-[var(--text-main)]">
                  <WarningCircle className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
                  <div>{cavemanChecking ? "Verifying Caveman skill..." : cavemanMessage}</div>
                </Card.Content>
              </Card>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto pr-1">
              {activeSession ? (
                <div className="flex flex-col gap-4">
                  {activeSession.messages.map((message) => (
                    <Card
                      className={`shadow-none ${
                        message.role === "assistant"
                          ? "mr-0 border border-[var(--border-soft)] bg-[var(--bg-surface)] md:mr-12"
                          : "ml-0 border border-[var(--accent)] bg-[linear-gradient(135deg,rgba(189,147,249,0.16),rgba(139,233,253,0.08))] md:ml-12"
                      }`}
                      key={message.id}
                    >
                      <Card.Content className="px-4 py-4">
                        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
                          {message.role}
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-main)]">
                          {message.content}
                        </div>
                      </Card.Content>
                    </Card>
                  ))}

                  {activeSession.messages.length === 0 ? (
                    <Card className={EMPTY_STATE_CARD_CLASS}>
                      <Card.Content className="grid min-h-56 place-items-center px-8 py-8 text-center text-sm leading-7 text-[var(--text-subtle)]">
                        Start a topic. PRD, SPEC, supporting docs, and the workspace tree are
                        already attached to the first turn.
                      </Card.Content>
                    </Card>
                  ) : null}
                </div>
              ) : (
                <Card className={EMPTY_STATE_CARD_CLASS}>
                  <Card.Content className="grid min-h-56 place-items-center px-8 py-8 text-center text-sm leading-7 text-[var(--text-subtle)]">
                    Create a topic to start the agent chat workspace.
                  </Card.Content>
                </Card>
              )}
            </div>

            <footer className="border-t border-[var(--border-strong)] pt-4">
              <TextArea
                className={TEXTAREA_CLASS}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder="Ask the agent anything about this topic. Type @ to attach a workspace file."
                value={activeDraft}
              />

              {mentionQuery.length > 0 ? (
                <Card className={`${ATTACH_CARD_CLASS} mt-3`}>
                  <Card.Content className="max-h-44 overflow-auto px-2 py-2">
                    {attachableFiles.length > 0 ? (
                      attachableFiles.slice(0, 8).map((entry) => (
                        <Button
                          className={LIST_ITEM_BUTTON_CLASS}
                          key={entry.path}
                          onPress={() => onAttachFile(entry.path)}
                        >
                          <Attachment className="size-4" />
                          <span className="truncate">{entry.path}</span>
                        </Button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-[var(--text-subtle)]">
                        No matching files.
                      </div>
                    )}
                  </Card.Content>
                </Card>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-subtle)]">
                  <ChatLines className="size-4 text-[var(--accent-2)]" />
                  {activeSession?.runtime.executionSummary ?? "Ready for the next prompt."}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activeSession?.runtime.awaitingApproval ? (
                    <Button className={PRIMARY_BUTTON_CLASS} onPress={onApprove}>
                      <CheckCircle className="size-4" />
                      Approve
                    </Button>
                  ) : null}
                  {activeSession?.runtime.isBusy ? (
                    <Button
                      className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[rgba(255,85,85,0.32)] bg-[rgba(255,85,85,0.16)] px-4 py-3 font-medium text-[var(--danger)] transition hover:-translate-y-0.5"
                      onPress={onStop}
                    >
                      <XmarkCircle className="size-4" />
                      Stop
                    </Button>
                  ) : null}
                  <Button
                    className={PRIMARY_BUTTON_CLASS}
                    isDisabled={!canSend}
                    onPress={onSend}
                  >
                    <SendSolid className="size-4" />
                    Send
                  </Button>
                </div>
              </div>
            </footer>
          </Card.Content>
        </Card>

        <Card className={PANEL_CLASS}>
          <Card.Content className={PANEL_CONTENT_CLASS}>
            <div className="flex items-center gap-3">
              <Settings className="size-5 text-[var(--accent-2)]" />
              <h2 className={PANEL_TITLE_CLASS}>Context & Artifacts</h2>
            </div>

            {activeSession ? (
              <>
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                  <SelectField
                    label="Model"
                    onChange={(selectedModel) =>
                      onSaveSessionConfig({
                        sessionId: activeSession.id,
                        selectedModel,
                        selectedReasoning: activeSession.selectedReasoning,
                        autonomyMode: activeSession.autonomyMode,
                        contextItems: activeSession.contextItems
                      })
                    }
                    options={getModelOptions(
                      configuredModelProviders.length === 1
                        ? configuredModelProviders[0]
                        : undefined
                    )}
                    value={activeSession.selectedModel}
                  />
                  <SelectField
                    label="Reasoning"
                    onChange={(selectedReasoning) =>
                      onSaveSessionConfig({
                        sessionId: activeSession.id,
                        selectedModel: activeSession.selectedModel,
                        selectedReasoning,
                        autonomyMode: activeSession.autonomyMode,
                        contextItems: activeSession.contextItems
                      })
                    }
                    options={getReasoningOptions(activeSession.selectedModel)}
                    value={activeSession.selectedReasoning}
                  />
                  <SelectField
                    label="Autonomy"
                    onChange={(autonomyMode) =>
                      onSaveSessionConfig({
                        sessionId: activeSession.id,
                        selectedModel: activeSession.selectedModel,
                        selectedReasoning: activeSession.selectedReasoning,
                        autonomyMode,
                        contextItems: activeSession.contextItems
                      })
                    }
                    options={AUTONOMY_OPTIONS.map((value) => ({
                      value,
                      label: value.replace("_", " ")
                    }))}
                    value={activeSession.autonomyMode}
                  />
                </div>

                <div className="grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    Attached Context
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeSession.contextItems.map((item) => (
                      <Button
                        className={CONTEXT_CHIP_CLASS}
                        key={item.id}
                        onPress={() => onRemoveContextItem(item.id)}
                      >
                        {item.label}
                        <span className="text-[var(--text-muted)]">x</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    Attach Files
                  </div>
                  <Input
                    className={INPUT_CLASS}
                    onChange={(event) => setContextSearch(event.target.value)}
                    placeholder="Attach workspace files"
                    value={contextSearch}
                  />
                  <Card className={ATTACH_CARD_CLASS}>
                    <Card.Content className="max-h-48 overflow-auto px-2 py-2">
                      {attachableFiles.length > 0 ? (
                        attachableFiles.slice(0, 18).map((entry) => (
                          <Button
                            className={LIST_ITEM_BUTTON_CLASS}
                            key={entry.path}
                            onPress={() => onAttachFile(entry.path)}
                          >
                            <Attachment className="size-4" />
                            <span className="truncate">{entry.path}</span>
                          </Button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-[var(--text-subtle)]">
                          No matching files.
                        </div>
                      )}
                    </Card.Content>
                  </Card>
                </div>

                <div className="grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    Current Diff
                  </div>
                  <DiffPreview diff={activeSession.runtime.pendingDiff ?? "No diff captured yet."} />
                </div>

                <Card className={TERMINAL_CARD_CLASS}>
                  <Card.Content className="grid min-h-0 gap-2 overflow-auto px-3 py-3 font-[var(--font-mono)] text-xs leading-6 text-[var(--text-main)]">
                    {activeSession.runtime.terminalOutput.length === 0 ? (
                      <div className="text-[var(--text-subtle)]">
                        Terminal output will appear here for the active topic.
                      </div>
                    ) : (
                      activeSession.runtime.terminalOutput.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                      ))
                    )}
                  </Card.Content>
                </Card>
              </>
            ) : (
              <Card className={EMPTY_STATE_CARD_CLASS}>
                <Card.Content className="grid min-h-56 place-items-center px-8 py-8 text-center text-sm leading-7 text-[var(--text-subtle)]">
                  Select a topic to inspect context, diff, and terminal output.
                </Card.Content>
              </Card>
            )}
          </Card.Content>
        </Card>
      </div>
    </section>
  );
}

function SelectField<Value extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<{ value: Value; label: string; hint?: string }>;
  value: Value;
  onChange: (value: Value) => void;
}) {
  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (key !== null) {
        onChange(String(key) as Value);
      }
    },
    [onChange]
  );

  return (
    <Select
      className="flex w-full min-w-0 flex-col gap-2"
      onSelectionChange={handleSelectionChange}
      selectedKey={value}
    >
      <Label className={FIELD_LABEL_CLASS}>{label}</Label>
      <Select.Trigger className={SELECT_TRIGGER_CLASS}>
        <Select.Value className="min-w-0 flex-1 truncate text-left text-[15px] text-[var(--text-main)]" />
        <Select.Indicator className="size-4 shrink-0 text-[var(--text-subtle)]" />
      </Select.Trigger>
      <Select.Popover className="min-w-56 rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)] backdrop-blur-xl">
        <ListBox className="outline-none">
          {options.map((option) => (
            <ListBox.Item
              className={LISTBOX_ITEM_CLASS}
              id={option.value}
              key={option.value}
              textValue={option.label}
            >
              <div className="flex flex-col gap-1">
                <span>{option.label}</span>
                {option.hint ? (
                  <small className="text-sm leading-5 text-[var(--text-subtle)]">
                    {option.hint}
                  </small>
                ) : null}
              </div>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
