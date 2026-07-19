import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { FrontendContextQueryScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import {
  ContextQueriesView,
  type ContextQueryViewIntent,
} from "../../src/features/queries/ui/context-queries-view";
import { mount } from "./helpers/mount";

function createHarness() {
  const model = queryModel();
  const onIntent = vi.fn(async (_intent: ContextQueryViewIntent) => {});
  const view = new ContextQueriesView({
    getModel: () => model,
    subscribe: () => () => {},
    onBack: vi.fn(),
    onRefresh: vi.fn(async () => {}),
    onIntent,
  });
  return { view, onIntent };
}

describe("ContextQueriesView", () => {
  it("shows query identity and metadata without exposing source code", () => {
    const harness = createHarness();
    const el = mount(harness.view);

    expect(el.matches(".chatobby-queries.chatobby-page")).toBe(true);
    expect(el.querySelector(".chatobby-queries__header.chatobby-page__header")).not.toBeNull();
    expect(el.querySelector(".chatobby-queries__body.chatobby-page__body")).not.toBeNull();
    expect(el.querySelectorAll(".chatobby-queries__header .chatobby-page__icon-button")).toHaveLength(3);
    expect(el.textContent).toContain("Project status");
    expect(el.textContent).toContain("Adds the current project status");
    expect(el.querySelector(".chatobby-queries__disclosure")?.getAttribute("data-icon")).toBe("chevron-right");
    expect(el.querySelector("textarea")).toBeNull();

    el.querySelector<HTMLButtonElement>(".chatobby-queries__summary-open")?.click();
    expect(el.textContent).toContain("Source code is intentionally kept out of this page");
    expect(el.querySelector("textarea")).toBeNull();
    expect(el.textContent).not.toContain("export default");

    const css = readFileSync("src/features/queries/ui/queries.css", "utf8");
    expect(css).toMatch(/\.chatobby-queries button\.chatobby-queries__summary-open[\s\S]*background: transparent;/u);
    expect(css).toMatch(/@container \(max-width: 420px\)[\s\S]*chatobby-queries__editor/u);
  });

  it("creates metadata only and leaves script scaffolding to the runtime", async () => {
    const harness = createHarness();
    const el = mount(harness.view);
    el.querySelector<HTMLButtonElement>('button[aria-label="Add context query"]')?.click();

    const inputs = el.querySelectorAll<HTMLInputElement>(".chatobby-queries__field input");
    inputs[0]!.value = "Current tasks";
    inputs[1]!.value = "Adds the open project tasks";
    [...el.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Save")
      ?.click();

    await vi.waitFor(() => expect(harness.onIntent).toHaveBeenCalledWith({
      type: "queries.save",
      payload: {
        name: "Current tasks",
        description: "Adds the open project tasks",
        trigger: "session_start",
        queryId: undefined,
        expectedQueryRevision: undefined,
      },
    }));
  });
});

function queryModel(): FrontendContextQueryScreenViewModel {
  return {
    screenId: "queries",
    revision: 1,
    loading: false,
    projectName: "Example project",
    projectDirectory: "C:\\Projects\\Example",
    trusted: true,
    items: [
      {
        id: "query-1",
        revision: 1,
        name: "Project status",
        description: "Adds the current project status",
        trigger: "session_start",
        timingLabel: "At the start of a new session",
        enabled: false,
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
    ],
  };
}
