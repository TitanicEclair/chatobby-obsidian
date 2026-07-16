import { describe, expect, it, vi } from "vitest";
import type { FrontendEventScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { EventsView, type EventViewIntent } from "../../src/features/events/ui/events-view";
import { mount } from "./helpers/mount";

function buttonWithText(root: HTMLElement, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button;
}

function createHarness(
  onSave?: (intent: Extract<EventViewIntent, { type: "events.save" }>) => Promise<void>,
  createEditor: () => NonNullable<FrontendEventScreenViewModel["editor"]> = editorModel,
) {
  let model = screenModel();
  const listeners = new Set<(value: FrontendEventScreenViewModel | null) => void>();
  const publish = () => { for (const listener of listeners) listener(model); };
  const onIntent = vi.fn(async (intent: EventViewIntent) => {
    if (intent.type === "events.begin-edit") {
      model = { ...model, editor: createEditor() };
      publish();
    } else if (intent.type === "events.set-editor-project" && model.editor) {
      model = { ...model, editor: { ...model.editor, projectPath: intent.payload.projectPath } };
      publish();
    } else if (intent.type === "events.save") {
      await onSave?.(intent);
    }
  });
  const view = new EventsView({
    getModel: () => model,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onBack: vi.fn(),
    onRefresh: vi.fn(async () => {}),
    onIntent,
  });
  return { view, onIntent };
}

describe("EventsView", () => {
  it("renders an understandable empty state and opens the runtime-backed event editor", async () => {
    const harness = createHarness();
    const root = mount(harness.view);
    expect(root.matches(".chatobby-events.chatobby-page")).toBe(true);
    expect(root.querySelector(".chatobby-events__header.chatobby-page__header")).not.toBeNull();
    expect(root.querySelector(".chatobby-events__tabs.chatobby-page__tabs")).not.toBeNull();
    expect(root.querySelector(".chatobby-events__body.chatobby-page__body")).not.toBeNull();
    expect(root.querySelectorAll(".chatobby-events__header .chatobby-page__icon-button")).toHaveLength(2);
    expect(root.textContent).toContain("No events yet");
    buttonWithText(root, "New event").click();
    await vi.waitFor(() => expect(root.textContent).toContain("Create event"));
    expect(root.textContent).toContain("Standard safeguards");
    expect(root.textContent).toContain("Researcher");
    expect(buttonWithText(root, "Save event").disabled).toBe(false);
  });

  it("requires explicit background consent and dispatches project, policy, agent, and run policy", async () => {
    const saved: Extract<EventViewIntent, { type: "events.save" }>[] = [];
    const harness = createHarness(async (intent) => { saved.push(intent); });
    const root = mount(harness.view);
    buttonWithText(root, "New event").click();
    await vi.waitFor(() => expect(root.textContent).toContain("Standard safeguards"));

    const inputs = [...root.querySelectorAll<HTMLInputElement>('input[type="text"]')];
    inputs[0]!.value = "Morning review";
    inputs[0]!.dispatchEvent(new Event("input"));
    const textarea = root.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("instructions field missing");
    textarea.value = "Summarize the open tasks for today.";
    textarea.dispatchEvent(new Event("input"));
    const selects = [...root.querySelectorAll<HTMLSelectElement>("select")];
    selects[0]!.value = "Projects/Current";
    selects[0]!.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(root.querySelectorAll("select")[1]?.disabled).toBe(false));
    const refreshedSelects = [...root.querySelectorAll<HTMLSelectElement>("select")];
    refreshedSelects[1]!.value = "read-only";
    refreshedSelects[1]!.dispatchEvent(new Event("change"));
    refreshedSelects[2]!.value = "researcher";
    refreshedSelects[2]!.dispatchEvent(new Event("change"));

    const background = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][1]!;
    background.click();
    root.querySelector<HTMLFormElement>("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(root.textContent).toContain("Confirm background execution");
    expect(saved).toHaveLength(0);
    const consent = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][2]!;
    consent.click();
    root.querySelector<HTMLFormElement>("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.payload).toMatchObject({
      name: "Morning review",
      projectPath: "Projects/Current",
      permissionProfileId: "read-only",
      agentId: "researcher",
      requireApproval: true,
      allowWhenViewClosed: true,
      backgroundConsent: true,
    });
  });

  it("edits a locale-aware calendar schedule with recurrence and an occurrence limit", async () => {
    const saved: Extract<EventViewIntent, { type: "events.save" }>[] = [];
    const harness = createHarness(async (intent) => { saved.push(intent); });
    const root = mount(harness.view);
    buttonWithText(root, "New event").click();
    await vi.waitFor(() => expect(root.querySelector(".chatobby-events__schedule")).not.toBeNull());

    const date = fieldControl<HTMLInputElement>(root, "Date");
    const time = fieldControl<HTMLInputElement>(root, "Time");
    expect(date.type).toBe("date");
    expect(time.type).toBe("time");
    expect(root.querySelector(".chatobby-events__schedule-summary")?.textContent).toContain("2026");
    date.value = "2026-07-20";
    date.dispatchEvent(new Event("change"));
    time.value = "15:30";
    time.dispatchEvent(new Event("change"));

    const repeat = fieldControl<HTMLSelectElement>(root, "Repeat");
    repeat.value = "daily";
    repeat.dispatchEvent(new Event("change"));
    const every = fieldControl<HTMLInputElement>(root, "Repeat every");
    every.value = "2";
    every.dispatchEvent(new Event("input"));
    const ends = fieldControl<HTMLSelectElement>(root, "Ends");
    ends.value = "after";
    ends.dispatchEvent(new Event("change"));
    const occurrences = fieldControl<HTMLInputElement>(root, "Occurrences");
    occurrences.value = "5";
    occurrences.dispatchEvent(new Event("input"));

    const name = root.querySelector<HTMLInputElement>('input[type="text"]');
    const prompt = root.querySelector<HTMLTextAreaElement>("textarea");
    if (!name || !prompt) throw new Error("event fields missing");
    name.value = "Every other day";
    name.dispatchEvent(new Event("input"));
    prompt.value = "Review this project's tasks and report the next action.";
    prompt.dispatchEvent(new Event("input"));
    root.querySelector<HTMLFormElement>("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.payload).toMatchObject({
      scheduleStartAt: "2026-07-20T15:30",
      scheduleRepeat: "daily",
      scheduleInterval: 2,
      scheduleEnd: "after",
      scheduleEndOccurrences: 5,
    });
  });

  it("opens the schedule editor when a running older backend omits recurrence fields", async () => {
    const legacyEditor = editorModel();
    for (const key of [
      "scheduleStartAt",
      "scheduleRepeat",
      "scheduleInterval",
      "scheduleWeekdays",
      "scheduleEnd",
      "scheduleEndDate",
      "scheduleEndOccurrences",
    ] as const) Reflect.deleteProperty(legacyEditor, key);
    const harness = createHarness(undefined, () => legacyEditor);
    const root = mount(harness.view);

    buttonWithText(root, "New event").click();

    await vi.waitFor(() => expect(root.querySelector(".chatobby-events__schedule")).not.toBeNull());
    expect(fieldControl<HTMLInputElement>(root, "Date").value).not.toBe("");
    expect(fieldControl<HTMLInputElement>(root, "Time").value).not.toBe("");
  });
});

function fieldControl<T extends HTMLInputElement | HTMLSelectElement>(root: HTMLElement, label: string): T {
  const field = [...root.querySelectorAll<HTMLLabelElement>("label")].find((candidate) =>
    [...candidate.children].some((child) => child.tagName === "SPAN" && child.textContent === label));
  const control = field?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
  if (!control) throw new Error(`field not found: ${label}`);
  return control as T;
}

function screenModel(): FrontendEventScreenViewModel {
  return {
    screenId: "events",
    revision: 1,
    loading: false,
    definitions: [],
    occurrences: [],
    pendingApprovalCount: 0,
  };
}

function editorModel(): NonNullable<FrontendEventScreenViewModel["editor"]> {
  return {
    name: "",
    description: "",
    projectPath: "",
    permissionProfileId: "standard-safeguards",
    agentId: "main",
    enabled: true,
    triggerKind: "schedule",
    triggerValue: "0 9 * * *",
    scheduleStartAt: "2026-07-18T09:00",
    scheduleRepeat: "none",
    scheduleInterval: 1,
    scheduleWeekdays: [],
    scheduleEnd: "never",
    scheduleEndDate: "2026-07-18",
    scheduleEndOccurrences: 10,
    triggerRecursive: true,
    triggerDebounceMs: 750,
    prompt: "",
    requireApproval: true,
    allowWhenViewClosed: false,
    backgroundConsent: false,
    maxRunsPerDay: 24,
    maxRuntimeMinutes: 10,
    projectChoices: [{ value: "", label: "Vault (vault root)" }, { value: "Projects/Current", label: "Projects/Current" }],
    permissionChoices: [{ value: "standard-safeguards", label: "Standard safeguards" }, { value: "read-only", label: "Read only" }],
    agentChoices: [{ value: "main", label: "Main agent" }, { value: "researcher", label: "Researcher" }],
    saveEnabled: true,
  };
}
