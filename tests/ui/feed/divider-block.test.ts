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

  it("shows a live elapsed compaction row and preserves the custom focus faintly below it", () => {
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
      detail: "Preserve the migration decision",
    });
    const element = mount(view);

    expect(element.querySelector(".chatobby-divider-block__activity-label")?.textContent).toBe("Compacting for 1s");
    expect(element.querySelector(".chatobby-divider-block__activity-detail")?.textContent).toBe("Preserve the migration decision");

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
      detail: "Preserve the migration decision",
    });
    expect(element.querySelector(".chatobby-divider-block__activity-label")?.textContent).toBe("Compacted in 3s");
    view.destroy();
  });
});
