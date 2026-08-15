import { afterEach, describe, expect, it, vi } from "vitest";
import { DividerBlockView } from "../../../src/ui/feed/divider-block";
import { mount } from "../helpers/mount";

describe("DividerBlockView", () => {
  afterEach(() => vi.useRealTimers());

  it("updates a live compaction divider in place when compaction completes", () => {
    const view = new DividerBlockView({
      type: "divider",
      id: "compaction-marker",
      label: "Compacting context",
      tone: "active",
      animated: true,
    });
    const element = mount(view);
    const label = element.querySelector(".chatobby-divider-block__label");

    expect(label?.textContent).toBe("Compacting context");
    expect(element.querySelector(".chatobby-divider-block__dots")?.classList.contains("is-animated")).toBe(true);

    view.setBlock({
      type: "divider",
      id: "compaction-marker",
      label: "Context compacted.",
      tone: "done",
    });

    expect(element.querySelector(".chatobby-divider-block__label")).toBe(label);
    expect(label?.textContent).toBe("Context compacted.");
    expect(element.querySelector(".chatobby-divider-block__dots")?.classList.contains("is-animated")).toBe(false);
  });

  it("shows live elapsed time, truthful lifecycle steps, and bounded progress detail", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const view = new DividerBlockView({
      type: "divider",
      id: "compaction-marker",
      label: "Compacting context",
      tone: "active",
      animated: true,
      activityStartedAt: 10_000,
      activityLabel: "Compacting",
      detail: "Working set 268k tokens → target at most 224k tokens",
      activitySteps: [
        { id: "preparing", label: "Preparing", state: "complete" },
        { id: "writing-checkpoint", label: "Writing handoff", state: "active" },
        { id: "validating-coverage", label: "Checking coverage", state: "pending" },
      ],
    });
    const element = mount(view);

    expect(element.querySelector(".chatobby-divider-block__activity-label")?.textContent).toBe("Compacting for 1s");
    expect(element.querySelector(".chatobby-divider-block__activity-detail")?.textContent).toBe(
      "Working set 268k tokens → target at most 224k tokens",
    );
    expect(element.querySelectorAll(".chatobby-divider-block__step")).toHaveLength(3);
    expect(element.querySelector('[data-step-id="preparing"]')?.classList.contains("is-complete")).toBe(true);
    expect(element.querySelector('[data-step-id="writing-checkpoint"]')?.classList.contains("is-active")).toBe(true);

    vi.advanceTimersByTime(2_000);
    expect(element.querySelector(".chatobby-divider-block__activity-label")?.textContent).toBe("Compacting for 2s");

    vi.advanceTimersByTime(63_000);
    expect(element.querySelector(".chatobby-divider-block__activity-label")?.textContent).toBe("Compacting for 1m 5s");

    vi.advanceTimersByTime(3_535_000);
    expect(element.querySelector(".chatobby-divider-block__activity-label")?.textContent).toBe("Compacting for 1h 0m 0s");

    view.setBlock({
      type: "divider",
      id: "compaction-marker",
      label: "Context compacted.",
      tone: "done",
      activityStartedAt: 10_000,
      activityEndedAt: 12_500,
      activityLabel: "Compacting",
      detail: "Working set 268k tokens → target at most 224k tokens",
    });
    expect(element.querySelector(".chatobby-divider-block__activity-label")?.textContent).toBe("Compacted in 3s");
    view.destroy();
  });
});
