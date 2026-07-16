import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FrontendTaskPlanViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { TaskProgress } from "../../src/features/tasks/public";

describe("TaskProgress", () => {
  it("previews every active task and expands to a non-interactive state list", () => {
    const host = document.createElement("div");
    const progress = new TaskProgress(host);
    progress.setModel(model());

    expect(host.hasClass("is-hidden")).toBe(false);
    expect(host.textContent).toContain("Task 2");
    expect(host.textContent).toContain("Task 3");
    expect(host.textContent).toContain("1 done task, 3 more tasks");
    expect(host.querySelectorAll(".chatobby-task-progress__spinner")).toHaveLength(2);
    expect(host.querySelector(".chatobby-task-progress__list")).toBeNull();

    const toggle = host.querySelector<HTMLButtonElement>(".chatobby-task-progress__toggle");
    toggle?.click();

    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    const rerenderedToggle = host.querySelector<HTMLButtonElement>(".chatobby-task-progress__toggle");
    expect(rerenderedToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelectorAll(".chatobby-task-progress__item")).toHaveLength(4);
    expect(host.querySelectorAll(".chatobby-task-progress__item button")).toHaveLength(0);
    expect(host.textContent).toContain("Completed");
    expect(host.textContent).toContain("Blocked");
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

  it("uses the composer width and a transparent responsive surface", () => {
    const css = readFileSync("src/features/tasks/ui/tasks.css", "utf8");
    expect(css).toContain("--chatobby-content-max");
    expect(css).toMatch(/\.chatobby-task-progress-host\s*\{[^}]*background:\s*transparent;/su);
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
