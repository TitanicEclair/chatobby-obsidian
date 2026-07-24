import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FrontendTaskPlanViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { TaskProgress } from "../../src/features/tasks/public";

describe("TaskProgress", () => {
  afterEach(() => vi.useRealTimers());

  it("previews one primary task and expands to a non-interactive keyed list", () => {
    const host = document.createElement("div");
    const progress = new TaskProgress(host);
    progress.setModel(model());

    expect(host.hasClass("is-hidden")).toBe(false);
    expect(host.textContent).toContain("Task 2");
    expect(host.textContent).not.toContain("Task 3");
    expect(host.textContent).toContain("+1 active");
    expect(host.textContent).toContain("1 done task, 3 more tasks");
    expect(host.querySelectorAll(".chatobby-task-progress__spinner")).toHaveLength(1);
    expect(host.querySelector(".chatobby-task-progress__list")?.hasClass("is-hidden")).toBe(true);

    const toggle = host.querySelector<HTMLButtonElement>(".chatobby-task-progress__toggle");
    toggle?.click();

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelectorAll(".chatobby-task-progress__item")).toHaveLength(4);
    expect(host.querySelectorAll(".chatobby-task-progress__item button")).toHaveLength(0);
    expect(host.textContent).toContain("Completed");
    expect(host.textContent).toContain("Blocked");
  });

  it("updates active task state in place while preserving the expanded list", () => {
    const host = document.createElement("div");
    const progress = new TaskProgress(host);
    progress.setModel(model());
    const toggle = host.querySelector<HTMLButtonElement>(".chatobby-task-progress__toggle");
    toggle?.click();
    const list = host.querySelector<HTMLElement>(".chatobby-task-progress__list");
    const retainedRow = list?.querySelector<HTMLElement>("[data-page-key='three']");
    progress.setModel({
      revision: 5,
      completedCount: 2,
      remainingCount: 2,
      summary: "2 done tasks, 2 more tasks",
      items: model().items.map((item) =>
        item.id === "two"
          ? { ...item, status: "completed" as const }
          : item.id === "three"
            ? { ...item, text: "Verify live UI updates" }
            : item,
      ),
    });

    expect(host.querySelector(".chatobby-task-progress__toggle")).toBe(toggle);
    expect(host.querySelector(".chatobby-task-progress__list")).toBe(list);
    expect(list?.querySelector("[data-page-key='three']")).toBe(retainedRow);
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(host.textContent).toContain("Task 3");
    expect(host.textContent).toContain("Verify live UI updates");
  });

  it("shows the blocked or next pending task instead of an ambiguous paused state", () => {
    const host = document.createElement("div");
    const progress = new TaskProgress(host);
    progress.setModel({
      revision: 1,
      completedCount: 0,
      remainingCount: 2,
      summary: "0 done tasks, 2 more tasks",
      items: [
        { id: "pending", step: 1, text: "Wait for the dependency", status: "pending" },
        { id: "blocked", step: 2, text: "Needs permission", status: "blocked" },
      ],
    });

    expect(host.textContent).toContain("Task 2");
    expect(host.textContent).toContain("Needs permission");
    expect(host.textContent).toContain("Blocked");
    expect(host.textContent).not.toContain("Tasks paused");
  });

  it("stays out of layout when the session has no tracked tasks", () => {
    const host = document.createElement("div");
    const progress = new TaskProgress(host);
    progress.setModel({ revision: 0, completedCount: 0, remainingCount: 0, summary: "No tracked tasks", items: [] });

    expect(host.hasClass("is-hidden")).toBe(true);
    expect(host.childElementCount).toBe(0);
  });

  it("leaves the layout as soon as every tracked task is complete", () => {
    const host = document.createElement("div");
    const progress = new TaskProgress(host);
    progress.setModel({
      revision: 8,
      completedCount: 2,
      remainingCount: 0,
      summary: "2 done tasks",
      items: [
        { id: "one", step: 1, text: "Implement", status: "completed" },
        { id: "two", step: 2, text: "Verify", status: "completed" },
      ],
    });

    expect(host.hasClass("is-hidden")).toBe(true);
    expect(host.childElementCount).toBe(0);
  });

  it("briefly acknowledges completion after an active plan, then leaves layout", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    const progress = new TaskProgress(host);
    progress.setModel(model());
    progress.setModel({
      revision: 5,
      completedCount: 4,
      remainingCount: 0,
      summary: "4 done tasks",
      items: model().items.map((item) => ({ ...item, status: "completed" as const })),
    });

    expect(host.hasClass("is-hidden")).toBe(false);
    expect(host.textContent).toContain("Tasks complete");
    expect(host.querySelector<HTMLButtonElement>(".chatobby-task-progress__toggle")?.disabled).toBe(true);
    vi.advanceTimersByTime(1_200);
    expect(host.hasClass("is-hidden")).toBe(true);
    expect(host.childElementCount).toBe(0);
  });

  it("uses the composer width and a transparent responsive surface", () => {
    const css = readFileSync("src/features/tasks/ui/tasks.css", "utf8");
    expect(css).toContain("--chatobby-content-max");
    expect(css).toMatch(/\.chatobby-task-progress-host\s*\{[^}]*background:\s*transparent;/su);
    expect(css).toMatch(/\.chatobby-task-progress-host \.chatobby-task-progress__toggle\s*\{[^}]*background:\s*transparent;/su);
    expect(css).toContain("@container (max-width: 440px)");
  });
});

function model(): FrontendTaskPlanViewModel {
  return {
    revision: 4,
    completedCount: 1,
    remainingCount: 3,
    summary: "1 done task, 3 more tasks",
    items: [
      { id: "one", step: 1, text: "Inspect current state", status: "completed" },
      { id: "two", step: 2, text: "Implement transport", status: "in_progress" },
      { id: "three", step: 3, text: "Verify the UI", status: "in_progress" },
      { id: "four", step: 4, text: "Resolve external dependency", status: "blocked", note: "Waiting for access" },
    ],
  };
}
