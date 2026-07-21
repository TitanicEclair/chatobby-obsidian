import { describe, expect, it, vi } from "vitest";
import { OperationCoordinator } from "../../../src/features/operations/public";
import { SessionTransitionCoordinator } from "../../../src/ui/session/session-transition-coordinator";

describe("SessionTransitionCoordinator", () => {
  it("holds the loading surface until pending snapshots flush and two frames paint", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const operations = new OperationCoordinator();
    const host = document.createElement("div");
    host.className = "is-hidden";
    const flush = vi.fn();
    const coordinator = new SessionTransitionCoordinator(host, operations, flush);
    coordinator.open();

    let completeMutation = (): void => {};
    const transition = operations.run(
      { key: "session-transition", id: "session:resume", label: "Resuming session" },
      async () => {
        await new Promise<void>((resolve) => { completeMutation = resolve; });
        await coordinator.settle();
      },
    );

    expect(host.classList.contains("is-hidden")).toBe(false);
    completeMutation();
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(host.classList.contains("is-hidden")).toBe(false);

    frames.shift()?.(0);
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(host.classList.contains("is-hidden")).toBe(false);

    frames.shift()?.(1);
    await transition;
    expect(host.classList.contains("is-hidden")).toBe(true);

    coordinator.destroy();
    vi.unstubAllGlobals();
  });
});
