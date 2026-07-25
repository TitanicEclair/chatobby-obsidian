import { describe, expect, it, vi } from "vitest";
import type { FrontendMemoryScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { MemoryView, type MemoryViewIntent } from "../../src/ui/memory/memory-view";
import { mount } from "./helpers/mount";

function buttonWithText(el: HTMLElement, text: string): HTMLButtonElement {
  const button = [...el.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button;
}

function createHarness(overrides: {
  model?: FrontendMemoryScreenViewModel | null;
  onIntent?: (intent: MemoryViewIntent) => Promise<void>;
  onRefresh?: () => Promise<void>;
} = {}) {
  let model = overrides.model === undefined ? memoryModel() : overrides.model;
  const listeners = new Set<(next: FrontendMemoryScreenViewModel | null) => void>();
  const onIntent = vi.fn(overrides.onIntent ?? (async () => {}));
  const onRefresh = vi.fn(overrides.onRefresh ?? (async () => {}));
  const view = new MemoryView({
    getModel: () => model,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onBack: vi.fn(),
    onRefresh,
    onIntent,
  });
  return {
    view,
    onIntent,
    onRefresh,
    setModel(next: FrontendMemoryScreenViewModel): void {
      model = next;
      for (const listener of listeners) listener(next);
    },
  };
}

describe("MemoryView", () => {
  it("renders a loading state without starting backend work itself", () => {
    const harness = createHarness({ model: null });
    const el = mount(harness.view);
    expect(el.matches(".chatobby-memory-view.chatobby-page")).toBe(true);
    expect(el.querySelector(".chatobby-memory__header.chatobby-page__header")).not.toBeNull();
    expect(el.querySelector(".chatobby-memory__tabs.chatobby-page__tabs")?.nextElementSibling)
      .toBe(el.querySelector(".chatobby-page__status"));
    expect(el.querySelector(".chatobby-page__status")?.nextElementSibling)
      .toBe(el.querySelector(".chatobby-memory__body.chatobby-page__body"));
    expect(el.querySelectorAll(".chatobby-memory__header .chatobby-page__icon-button")).toHaveLength(2);
    expect(el.textContent).toContain("Loading memory");
    expect(harness.onRefresh).not.toHaveBeenCalled();
  });

  it("renders the runtime-owned memory surface without product-policy clutter", () => {
    const harness = createHarness();
    const el = mount(harness.view);

    expect(el.textContent).toContain("Vault profile");
    expect(el.textContent).toContain("Prefers concise technical answers");
    expect(el.textContent).toContain("Use Obsidian-aware tools for note edits");
    expect(el.textContent).not.toContain("Memory tools");
    expect(el.textContent).not.toContain("Activity");
    expect(el.textContent).not.toContain("Vault-wide memory");
    expect(el.querySelector(".chatobby-memory__detail")).toBeNull();
    expect(el.querySelectorAll(".chatobby-memory__record-category")).toHaveLength(2);
    expect(el.querySelectorAll(".chatobby-memory__record-divider")).toHaveLength(2);
  });

  it("dispatches runtime filtering and search intents instead of filtering records locally", async () => {
    const harness = createHarness();
    const el = mount(harness.view);
    buttonWithText(el, "Project").click();
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-view",
      payload: { filter: "project", query: "", category: "all", sort: "updated-desc" },
    }));

    const input = el.querySelector<HTMLInputElement>(".chatobby-memory__search-input");
    if (!input) throw new Error("search input missing");
    input.value = "concise";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-view",
      payload: { filter: "all", query: "concise", category: "all", sort: "updated-desc" },
    }));
    const categoryHarness = createHarness();
    const categoryEl = mount(categoryHarness.view);
    const category = categoryEl.querySelector<HTMLSelectElement>('select[aria-label="Memory category"]');
    if (!category) throw new Error("category filter missing");
    category.value = "preference";
    category.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(categoryHarness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-view",
      payload: { filter: "all", query: "", category: "preference", sort: "updated-desc" },
    }));

    const sortHarness = createHarness();
    const sortEl = mount(sortHarness.view);
    const sort = sortEl.querySelector<HTMLSelectElement>('select[aria-label="Sort memories"]');
    if (!sort) throw new Error("memory sort missing");
    sort.value = "last-used-desc";
    sort.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(sortHarness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-view",
      payload: { filter: "all", query: "", category: "all", sort: "last-used-desc" },
    }));
  });

  it("supports compact expand-retract records and progressive technical details", () => {
    const harness = createHarness();
    const el = mount(harness.view);
    el.querySelector<HTMLButtonElement>(".chatobby-memory__record-summary")?.click();
    expect(el.textContent).toContain("Saved explicitly");
    expect(el.textContent).toContain("History and technical details");
    expect(el.textContent).toContain("Record memory:1 · revision 1");
    el.querySelector<HTMLButtonElement>(".chatobby-memory__record-summary")?.click();
    expect(el.querySelector(".chatobby-memory__detail")).toBeNull();
  });

  it("preserves the memory page scroll position while expanding and retracting a record", () => {
    const harness = createHarness();
    const el = mount(harness.view);
    const body = el.querySelector<HTMLElement>(".chatobby-memory__body");
    if (!body) throw new Error("memory body missing");
    body.scrollTop = 480;

    el.querySelector<HTMLButtonElement>("[data-record-id='memory:2']")?.click();

    const expandedBody = el.querySelector<HTMLElement>(".chatobby-memory__body");
    expect(expandedBody?.scrollTop).toBe(480);
    expect(document.activeElement).toBe(el.querySelector("[data-record-id='memory:2']"));
    el.querySelector<HTMLButtonElement>("[data-record-id='memory:2']")?.click();
    expect(el.querySelector<HTMLElement>(".chatobby-memory__body")?.scrollTop).toBe(480);
  });

  it("dispatches archive and requires inline confirmation before delete", async () => {
    const harness = createHarness();
    const el = mount(harness.view);
    el.querySelector<HTMLButtonElement>(".chatobby-memory__record-summary")?.click();
    buttonWithText(el, "Archive").click();
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-status",
      payload: { recordId: "memory:1", expectedRecordRevision: 1, status: "archived" },
    }));

    buttonWithText(el, "Delete permanently").click();
    expect(el.textContent).toContain("Original chat transcripts are not changed");
    expect(harness.onIntent).not.toHaveBeenCalledWith(expect.objectContaining({ type: "memory.delete" }));
    buttonWithText(el, "Delete permanently").click();
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.delete",
      payload: { recordId: "memory:1", expectedRecordRevision: 1 },
    }));
  });

  it("renders suggestions and policy/storage controls from the view model", async () => {
    const harness = createHarness();
    const el = mount(harness.view);
    buttonWithText(el, "Suggestions1").click();
    expect(el.textContent).toContain("Use named session labels");
    buttonWithText(el, "Approve").click();
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.decide-candidate",
      payload: { candidateId: "candidate-1", decision: "approve" },
    }));
    const settingsHarness = createHarness();
    const settingsEl = mount(settingsHarness.view);
    buttonWithText(settingsEl, "Settings").click();
    const boundary = settingsEl.querySelector<HTMLSelectElement>('select[aria-label="Memory available in this project"]');
    if (!boundary) throw new Error("project memory selector missing");
    boundary.value = "project-only";
    boundary.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(settingsHarness.onIntent).toHaveBeenCalledWith({
      type: "memory.update-policy",
      payload: { projectBoundaryMode: "project-only" },
    }));
    const importHarness = createHarness();
    const importEl = mount(importHarness.view);
    buttonWithText(importEl, "Settings").click();
    buttonWithText(importEl, "Import Markdown changes").click();
    await vi.waitFor(() => expect(importHarness.onIntent).toHaveBeenCalledWith({ type: "memory.import-markdown", payload: {} }));
  });
});

function memoryModel(): FrontendMemoryScreenViewModel {
  return {
    screenId: "memory",
    revision: 1,
    loading: false,
    filter: "all",
    category: "all",
    categoryOptions: [
      { value: "all", label: "All categories" },
      { value: "preference", label: "Preferences" },
    ],
    sort: "updated-desc",
    sortOptions: [
      { value: "updated-desc", label: "Recently updated" },
      { value: "last-used-desc", label: "Recently used" },
    ],
    filters: [
      { id: "all", label: "Active", selected: true },
      { id: "profile", label: "Vault profile", selected: false },
      { id: "vault", label: "Vault memory", selected: false },
      { id: "project", label: "Project", selected: false },
      { id: "lessons", label: "Lessons", selected: false },
      { id: "archived", label: "Archived", selected: false },
    ],
    query: "",
    records: [
      {
        id: "memory:1",
        revision: 1,
        iconToken: "user-round",
        label: "Vault profile",
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
        content: "Use Obsidian-aware tools for note edits",
        provenanceLabel: "Imported from an earlier memory format",
        createdAt: "2026-07-02T00:00:00Z",
        updatedAt: "2026-07-10T00:00:00Z",
        lastReferencedAt: null,
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
  };
}
