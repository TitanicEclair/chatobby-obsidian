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
    replaceModelWithoutNotification(next: FrontendMemoryScreenViewModel): void {
      model = next;
    },
  };
}

describe("MemoryView", () => {
  it("selects another memory workspace through an explicit browsing intent", async () => {
    const harness = createHarness({ model: { ...memoryModel(), browseProjectId: null, browseOptions: [{ value: "", label: "Vault" }, { value: "project-one", label: "Research" }] } });
    const el = mount(harness.view);
    const select = el.querySelector<HTMLSelectElement>("select[aria-label='Viewing memory for']")!;
    select.value = "project-one";
    select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith(expect.objectContaining({ type: "memory.set-view", payload: expect.objectContaining({ browseProjectId: "project-one", scopeFilter: "available" }) })));
    expect(el.textContent).toContain("without changing your conversation");
  });
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
    expect(el.textContent).toContain("Available here");
    expect(el.textContent).toContain("Current project and inherited vault memory");
    expect(el.textContent).toContain("Prefers concise technical answers");
    expect(el.textContent).toContain("Use Obsidian-aware tools for note edits");
    expect(el.textContent).not.toContain("Memory tools");
    expect(el.textContent).not.toContain("Activity");
    expect(el.textContent).not.toContain("Vault-wide memory");
    expect(el.querySelector(".chatobby-memory__detail")).toBeNull();
    expect(el.querySelectorAll(".chatobby-memory__record-category")).toHaveLength(2);
    expect(el.querySelectorAll(".chatobby-memory__record-divider")).toHaveLength(2);
    expect(el.querySelector(".chatobby-memory__filters")).toBeNull();
  });

  it("dispatches runtime filtering and search intents instead of filtering records locally", async () => {
    const harness = createHarness();
    const el = mount(harness.view);
    expect(el.querySelector('select[aria-label="Memory scope"]')).toBeNull();

    const input = el.querySelector<HTMLInputElement>(".chatobby-memory__search-input");
    if (!input) throw new Error("search input missing");
    input.value = "concise";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-view",
      payload: { scopeFilter: "available", collection: "all", status: "active", query: "concise", lessonCategory: "all", sort: "updated-desc" },
    }));
    const categoryHarness = createHarness();
    const categoryEl = mount(categoryHarness.view);
    const collection = categoryEl.querySelector<HTMLSelectElement>('select[aria-label="Memory type"]');
    if (!collection) throw new Error("memory type filter missing");
    collection.value = "profile";
    collection.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(categoryHarness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-view",
      payload: { scopeFilter: "available", collection: "profile", status: "active", query: "", lessonCategory: "all", sort: "updated-desc" },
    }));

    const sortHarness = createHarness();
    const sortEl = mount(sortHarness.view);
    const sort = sortEl.querySelector<HTMLSelectElement>('select[aria-label="Sort memories"]');
    if (!sort) throw new Error("memory sort missing");
    sort.value = "last-used-desc";
    sort.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(sortHarness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-view",
      payload: { scopeFilter: "available", collection: "all", status: "active", query: "", lessonCategory: "all", sort: "last-used-desc" },
    }));
  });

  it("shows lesson subtypes only while the lesson collection is selected", async () => {
    const allHarness = createHarness();
    const allEl = mount(allHarness.view);
    expect(allEl.querySelector('select[aria-label="Lesson type"]')).toBeNull();

    const lessonHarness = createHarness({ model: memoryModel({ collection: "lessons" }) });
    const lessonEl = mount(lessonHarness.view);
    const lessonType = lessonEl.querySelector<HTMLSelectElement>('select[aria-label="Lesson type"]');
    if (!lessonType) throw new Error("lesson type filter missing");
    lessonType.value = "tool-quirk";
    lessonType.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(lessonHarness.onIntent).toHaveBeenCalledWith({
      type: "memory.set-view",
      payload: { scopeFilter: "available", collection: "lessons", status: "active", query: "", lessonCategory: "tool-quirk", sort: "updated-desc" },
    }));
  });

  it("defaults a Project-scoped Add form to the enabled current-Project target", async () => {
    const harness = createHarness({ model: memoryModel({ createTargets: projectCreateTargets() }) });
    const el = mount(harness.view);
    buttonWithText(el, "Add").click();

    const target = el.querySelector<HTMLSelectElement>('select[aria-label="Memory location"]');
    const content = el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory content"]');
    if (!target || !content) throw new Error("memory create form missing");
    expect(target.value).toBe("project");
    expect(target.querySelector<HTMLOptionElement>('option[value="user"]')?.disabled).toBe(true);

    content.value = "Keep this in the active Project.";
    buttonWithText(el, "Save memory").click();
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.create",
      payload: { target: "project", content: "Keep this in the active Project." },
    }));
  });

  it("does not restore a Vault target after the enabled target set becomes Project-scoped", async () => {
    const harness = createHarness();
    const el = mount(harness.view);
    buttonWithText(el, "Add").click();
    const initialTarget = el.querySelector<HTMLSelectElement>('select[aria-label="Memory location"]');
    const initialContent = el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory content"]');
    if (!initialTarget || !initialContent) throw new Error("memory create form missing");
    initialTarget.value = "user";
    initialContent.value = "Preserve the draft while scope changes.";

    harness.setModel(memoryModel({
      revision: 2,
      createTargets: projectCreateTargets(),
    }));

    const refreshedTarget = el.querySelector<HTMLSelectElement>('select[aria-label="Memory location"]');
    const refreshedContent = el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory content"]');
    expect(refreshedTarget?.value).toBe("project");
    expect(refreshedContent?.value).toBe("Preserve the draft while scope changes.");
    buttonWithText(el, "Save memory").click();
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.create",
      payload: { target: "project", content: "Preserve the draft while scope changes." },
    }));
  });

  it("does not derive write scope from the memory area being browsed", async () => {
    const harness = createHarness({
      model: memoryModel({
        scope: {
          label: "Browsed Project Beta",
          path: "Projects/Beta",
          description: "Records currently being browsed",
        },
        createTargets: [
          { value: "user", label: "Vault profile" },
          { value: "memory", label: "Vault memory" },
          { value: "project", label: "Browsed project", disabledReason: "Browsing does not move the active chat." },
          { value: "failure", label: "Lesson or correction" },
        ],
      }),
    });
    const el = mount(harness.view);
    buttonWithText(el, "Add").click();
    const target = el.querySelector<HTMLSelectElement>('select[aria-label="Memory location"]');
    const content = el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory content"]');
    if (!target || !content) throw new Error("memory create form missing");
    expect(target.value).toBe("user");
    content.value = "Keep the active session authority.";
    buttonWithText(el, "Save memory").click();
    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "memory.create",
      payload: { target: "user", content: "Keep the active session authority." },
    }));
  });

  it("rechecks the current projected target set immediately before dispatch", () => {
    const harness = createHarness();
    const el = mount(harness.view);
    buttonWithText(el, "Add").click();
    const content = el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory content"]');
    if (!content) throw new Error("memory create form missing");
    content.value = "Reject a stale Vault target.";

    harness.replaceModelWithoutNotification(memoryModel({
      revision: 2,
      createTargets: projectCreateTargets(),
    }));
    buttonWithText(el, "Save memory").click();

    expect(harness.onIntent).not.toHaveBeenCalled();
    expect(el.textContent).toContain("The selected memory location is no longer available.");
    expect(el.querySelector<HTMLSelectElement>('select[aria-label="Memory location"]')?.value).toBe("project");
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

function memoryModel(overrides: Partial<FrontendMemoryScreenViewModel> = {}): FrontendMemoryScreenViewModel {
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

function projectCreateTargets(): FrontendMemoryScreenViewModel["createTargets"] {
  return [
    { value: "user", label: "Vault profile", disabledReason: "Vault-wide memory writes require a Vault-scoped session." },
    { value: "memory", label: "Vault memory", disabledReason: "Vault-wide memory writes require a Vault-scoped session." },
    { value: "project", label: "Current project" },
    { value: "failure", label: "Lesson or correction" },
  ];
}
