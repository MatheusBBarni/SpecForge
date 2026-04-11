import { create } from "zustand";

import {
  DEFAULT_MODEL_ID,
  DEFAULT_REASONING_PROFILE,
  getModelLabel,
  getReasoningLabel,
  normalizeReasoningProfile
} from "../lib/agentConfig";
import { buildDefaultProjectSettings, normalizeProjectSettings } from "../lib/projectConfig";
import type {
  AutonomyMode,
  EditorTab,
  ModelId,
  PaneMode,
  ProjectSettings,
  ReasoningProfileId,
  SelectionRange,
  SpecAnnotation,
  WorkspaceTab
} from "../types";

interface ProjectState {
  prdContent: string;
  specContent: string;
  prdPath: string;
  specPath: string;
  configuredPrdPath: string;
  configuredSpecPath: string;
  supportingDocumentPaths: string[];
  prdPromptTemplate: string;
  specPromptTemplate: string;
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  autonomyMode: AutonomyMode;
  activeTab: WorkspaceTab;
  prdPaneMode: PaneMode;
  specPaneMode: PaneMode;
  reviewPrompt: string;
  selectedSpecRange: SelectionRange | null;
  annotations: SpecAnnotation[];
  isSpecApproved: boolean;
  openEditorTabs: EditorTab[];
  setProjectSettings: (settings: Partial<ProjectSettings>) => void;
  setConfiguredPrdPath: (path: string) => void;
  setConfiguredSpecPath: (path: string) => void;
  setSupportingDocumentPaths: (paths: string[]) => void;
  setPrdPromptTemplate: (prompt: string) => void;
  setSpecPromptTemplate: (prompt: string) => void;
  setPrdContent: (content: string, path?: string) => void;
  setSpecContent: (content: string, path?: string) => void;
  setSelectedModel: (model: ModelId) => void;
  setReasoningProfile: (profile: ReasoningProfileId) => void;
  setAutonomyMode: (mode: AutonomyMode) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  setPrdPaneMode: (mode: PaneMode) => void;
  setSpecPaneMode: (mode: PaneMode) => void;
  setReviewPrompt: (prompt: string) => void;
  setSelectedSpecRange: (range: SelectionRange | null) => void;
  resetWorkspaceContext: () => void;
  openEditorTab: (tab: Omit<EditorTab, "id">) => void;
  closeEditorTab: (path: string) => void;
  updateEditorTabContent: (path: string, content: string) => void;
  applyRefinement: () => void;
  approveSpec: () => void;
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildInitialAnnotations(): SpecAnnotation[] {
  return [
    {
      id: createId(),
      tone: "warning",
      title: "Rust Owns Execution",
      body: "The backend should own parsing, environment checks, and CLI gating so the React shell never executes commands directly."
    },
    {
      id: createId(),
      tone: "info",
      title: "Approval Modes Need Diff Context",
      body: "Stepped and milestone autonomy both need a visible diff and an interrupt path before the next agent action proceeds."
    },
    {
      id: createId(),
      tone: "success",
      title: "Theme Direction Locked",
      body: "Dracula is the default visual language. Light and system remain available in settings without diluting the IDE feel."
    }
  ];
}

function buildRefinementBlock(
  prompt: string,
  range: SelectionRange | null,
  model: ModelId,
  reasoning: ReasoningProfileId
) {
  const cleanedPrompt = prompt.trim();
  const shortTitle = cleanedPrompt
    .replace(/\s+/g, " ")
    .slice(0, 64)
    .replace(/[.:!?]+$/, "");
  const focusedExcerpt = range?.text.trim().replace(/\s+/g, " ").slice(0, 140) || "Entire approved specification";
  const modelLabel = getModelLabel(model);
  const reasoningLabel = getReasoningLabel(model, reasoning);

  return `### Refinement: ${shortTitle || "Spec update"}

- Requested via: ${modelLabel} (${reasoningLabel} reasoning)
- Focus area: ${focusedExcerpt}
- Updated requirement: ${cleanedPrompt || "Clarify the affected section and tighten acceptance criteria."}
- Acceptance criteria:
  - Reflect the change in the review workspace before execution begins.
  - Preserve the split-pane PRD/spec workflow and autonomy controls.
  - Surface any affected diff or milestone notes in the execution dashboard.`;
}

function createEditorTabId(path: string) {
  return `file:${path}` as const;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  ...buildInitialProjectState(),
  prdContent: "",
  specContent: "",
  autonomyMode: "milestone",
  activeTab: "review",
  prdPaneMode: "preview",
  specPaneMode: "preview",
  reviewPrompt: "",
  selectedSpecRange: null,
  annotations: buildInitialAnnotations(),
  isSpecApproved: false,
  openEditorTabs: [],
  setProjectSettings: (settings) =>
    set((state) => {
      const nextSettings = normalizeProjectSettings({
        selectedModel: state.selectedModel,
        selectedReasoning: state.selectedReasoning,
        prdPrompt: state.prdPromptTemplate,
        specPrompt: state.specPromptTemplate,
        prdPath: state.configuredPrdPath,
        specPath: state.configuredSpecPath,
        supportingDocumentPaths: state.supportingDocumentPaths,
        ...settings
      });

      return {
        configuredPrdPath: nextSettings.prdPath,
        configuredSpecPath: nextSettings.specPath,
        prdPromptTemplate: nextSettings.prdPrompt,
        specPromptTemplate: nextSettings.specPrompt,
        selectedModel: nextSettings.selectedModel,
        selectedReasoning: nextSettings.selectedReasoning,
        supportingDocumentPaths: nextSettings.supportingDocumentPaths
      };
    }),
  setConfiguredPrdPath: (configuredPrdPath) => set({ configuredPrdPath }),
  setConfiguredSpecPath: (configuredSpecPath) => set({ configuredSpecPath }),
  setSupportingDocumentPaths: (supportingDocumentPaths) => set({ supportingDocumentPaths }),
  setPrdPromptTemplate: (prdPromptTemplate) => set({ prdPromptTemplate }),
  setSpecPromptTemplate: (specPromptTemplate) => set({ specPromptTemplate }),
  setPrdContent: (prdContent, path) =>
    set({
      prdContent,
      prdPath: path ?? get().prdPath
    }),
  setSpecContent: (specContent, path) =>
    set({
      specContent,
      specPath: path ?? get().specPath,
      isSpecApproved: false
    }),
  setSelectedModel: (selectedModel) =>
    set((state) => ({
      selectedModel,
      selectedReasoning: normalizeReasoningProfile(selectedModel, state.selectedReasoning)
    })),
  setReasoningProfile: (selectedReasoning) =>
    set((state) => ({
      selectedReasoning: normalizeReasoningProfile(state.selectedModel, selectedReasoning)
    })),
  setAutonomyMode: (autonomyMode) => set({ autonomyMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setPrdPaneMode: (prdPaneMode) => set({ prdPaneMode }),
  setSpecPaneMode: (specPaneMode) => set({ specPaneMode }),
  setReviewPrompt: (reviewPrompt) => set({ reviewPrompt }),
  setSelectedSpecRange: (selectedSpecRange) => set({ selectedSpecRange }),
  resetWorkspaceContext: () =>
    set({
      activeTab: "review",
      openEditorTabs: [],
      selectedSpecRange: null
    }),
  openEditorTab: (tab) =>
    set((state) => {
      const tabId = createEditorTabId(tab.path);
      const existingTab = state.openEditorTabs.find((entry) => entry.path === tab.path);
      const openEditorTabs = existingTab
        ? state.openEditorTabs.map((entry) =>
            entry.path === tab.path ? { ...entry, title: tab.title } : entry
          )
        : [...state.openEditorTabs, { ...tab, id: tabId }];

      return {
        openEditorTabs,
        activeTab: tabId
      };
    }),
  closeEditorTab: (path) =>
    set((state) => {
      const nextTabs = state.openEditorTabs.filter((entry) => entry.path !== path);
      const closingTabId = createEditorTabId(path);
      const nextActiveTab =
        state.activeTab === closingTabId
          ? nextTabs[nextTabs.length - 1]?.id ?? "review"
          : state.activeTab;

      return {
        openEditorTabs: nextTabs,
        activeTab: nextActiveTab
      };
    }),
  updateEditorTabContent: (path, content) =>
    set((state) => ({
      openEditorTabs: state.openEditorTabs.map((entry) =>
        entry.path === path ? { ...entry, content } : entry
      )
    })),
  applyRefinement: () => {
    const state = get();
    const nextBlock = buildRefinementBlock(
      state.reviewPrompt,
      state.selectedSpecRange,
      state.selectedModel,
      state.selectedReasoning
    );

    set({
      specContent: state.specContent.trim()
        ? `${state.specContent.trim()}\n\n${nextBlock}`
        : nextBlock,
      reviewPrompt: "",
      specPaneMode: "edit",
      isSpecApproved: false,
      annotations: [
        {
          id: createId(),
          tone: "info",
          title: "Refinement Added",
          body: `The spec was extended with a focused change request: "${state.reviewPrompt.trim() || "Spec update"}".`
        },
        ...state.annotations
      ]
    });
  },
  approveSpec: () => {
    const state = get();

    set({
      isSpecApproved: true,
      annotations: [
        {
          id: createId(),
          tone: "success",
          title: "Spec Approved",
          body: "The technical specification is now locked for execution. Any subsequent edit will require re-approval."
        },
        ...state.annotations
      ]
    });
  }
}));

function buildInitialProjectState() {
  const defaults = normalizeProjectSettings();

  return {
    configuredPrdPath: defaults.prdPath,
    configuredSpecPath: defaults.specPath,
    prdPath: defaults.prdPath,
    specPath: defaults.specPath,
    prdPromptTemplate: defaults.prdPrompt,
    specPromptTemplate: defaults.specPrompt,
    selectedModel: DEFAULT_MODEL_ID,
    selectedReasoning: DEFAULT_REASONING_PROFILE,
    supportingDocumentPaths: defaults.supportingDocumentPaths
  };
}
