import type { FrontendMemoryScreenViewModel } from "../../../src/vendor/chatobby-client/frontend-contracts.js";

/** Shared synthetic read model for view and actual controller/protocol fixtures. */
export function memoryModel(overrides: Partial<FrontendMemoryScreenViewModel> = {}): FrontendMemoryScreenViewModel {
  return {
    screenId: "memory",
    revision: 1,
    loading: false,
    scope: {
      label: "Available here",
      path: "Projects/Chatobby",
      description: "Current project and inherited vault memory",
    },
    scopeFilter: "available",
    scopeOptions: [
      { value: "available", label: "Available here" },
      { value: "vault", label: "Vault only" },
      { value: "current-project", label: "Current project only" },
    ],
    collection: "all",
    collectionOptions: [
      { value: "all", label: "All memory" },
      { value: "profile", label: "Vault profile" },
      { value: "lessons", label: "Lessons" },
    ],
    status: "active",
    statusOptions: [
      { value: "active", label: "Active" },
      { value: "archived", label: "Archived" },
      { value: "all", label: "Any status" },
    ],
    lessonCategory: "all",
    lessonCategoryOptions: [
      { value: "all", label: "All lesson types" },
      { value: "tool-quirk", label: "Tool quirks" },
    ],
    sort: "updated-desc",
    sortOptions: [
      { value: "updated-desc", label: "Recently updated" },
      { value: "last-used-desc", label: "Recently used" },
    ],
    query: "",
    records: [
      {
        id: "memory:1",
        revision: 1,
        iconToken: "user-round",
        label: "Vault profile",
        locationLabel: "This vault",
        scopeRelationLabel: "Available here",
        content: "Prefers concise technical answers",
        provenanceLabel: "Saved explicitly",
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-07-11T00:00:00Z",
        lastReferencedAt: "2026-07-11T00:00:00Z",
        sensitivityLabel: "Vault Local",
        status: "active",
        availableActions: ["edit", "archive", "delete"],
        technicalLines: ["Record memory:1 · revision 1", "Created 2026-07-01 · last used 2026-07-11"],
      },
      {
        id: "memory:2",
        revision: 1,
        iconToken: "folder-kanban",
        label: "vault-a",
        locationLabel: "Projects/Chatobby",
        scopeRelationLabel: "Current project",
        content: "Use Obsidian-aware tools for note edits",
        provenanceLabel: "Imported from an earlier memory format",
        createdAt: "2026-07-02T00:00:00Z",
        updatedAt: "2026-07-10T00:00:00Z",
        lastReferencedAt: "2026-07-10T00:00:00Z",
        sensitivityLabel: "Unspecified",
        status: "active",
        availableActions: ["edit", "archive", "delete"],
        technicalLines: ["Record memory:2 · revision 1"],
      },
    ],
    candidates: [{ id: "candidate-1", actionLabel: "Add", content: "Use named session labels", reason: "Repeated correction" }],
    createTargets: [
      { value: "user", label: "Vault profile" },
      { value: "memory", label: "Vault memory" },
      { value: "project", label: "Current project" },
      { value: "failure", label: "Lesson or correction" },
    ],
    projectBoundary: {
      description: "Use vault and parent project memory.",
      value: "inherit",
      options: [
        { value: "inherit", label: "Vault and parent projects" },
        { value: "separate", label: "No parent projects" },
        { value: "project-only", label: "Only this project" },
      ],
    },
    learningSettings: [
      { id: "backgroundLearning", title: "Conversation learning", description: "Facts inferred during conversation review.", value: "suggest", options: [{ value: "off", label: "Off" }, { value: "suggest", label: "Suggest" }, { value: "auto", label: "Auto" }] },
      { id: "correctionLearning", title: "User corrections", description: "How explicit corrections become durable lessons.", value: "auto", options: [{ value: "off", label: "Off" }, { value: "suggest", label: "Suggest" }, { value: "auto", label: "Auto" }] },
      { id: "promptRouting", title: "Use memory in chat", description: "Whether relevant memory may be added to a prompt.", value: "hybrid", options: [{ value: "off", label: "Off" }, { value: "profile-project", label: "Vault and project only" }, { value: "hybrid", label: "Hybrid" }] },
    ],
    storage: {
      description: "SQLite is the source of truth. Markdown is a readable copy.",
      technicalLines: ["Database: C:/vault/.chatobby/memory.db"],
    },
    helpItems: ["Project memory never flows from a child into its parent."],
    ...overrides,
  };
}
