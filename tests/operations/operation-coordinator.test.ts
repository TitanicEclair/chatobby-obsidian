import { describe, expect, it, vi } from "vitest";
import { OperationConflictError, OperationCoordinator } from "../../src/features/operations/public";

describe("OperationCoordinator", () => {
  it("serializes one business domain across independent consumers", async () => {
    const coordinator = new OperationCoordinator();
    let release = (): void => {};
    const first = coordinator.run(
      { key: "session-transition", id: "palette:new", label: "Creating session" },
      () => new Promise<void>((resolve) => { release = resolve; }),
    );

    await expect(coordinator.run(
      { key: "session-transition", id: "slash:compact", label: "Compacting context" },
      async () => {},
    )).rejects.toMatchObject<Partial<OperationConflictError>>({
      name: "OperationConflictError",
      active: expect.objectContaining({ id: "palette:new", label: "Creating session" }),
    });

    release();
    await first;
    expect(coordinator.current("session-transition")).toBeNull();
  });

  it("releases a domain when the producer fails", async () => {
    const coordinator = new OperationCoordinator();
    await expect(coordinator.run(
      { key: "workflow-control", id: "workflow:pause", label: "Pausing workflow" },
      async () => { throw new Error("control failed"); },
    )).rejects.toThrow("control failed");

    await expect(coordinator.run(
      { key: "workflow-control", id: "workflow:cancel", label: "Cancelling workflow" },
      async () => "ok",
    )).resolves.toBe("ok");
  });

  it("allows compatible domains and publishes bounded state changes", async () => {
    const coordinator = new OperationCoordinator();
    const listener = vi.fn();
    coordinator.subscribe(listener);
    let release = (): void => {};
    const session = coordinator.run(
      { key: "session-state", id: "session:model", label: "Changing model" },
      () => new Promise<void>((resolve) => { release = resolve; }),
    );

    await expect(coordinator.run(
      { key: "workflow-control", id: "workflow:pause", label: "Pausing workflow" },
      async () => "paused",
    )).resolves.toBe("paused");
    expect(coordinator.all()).toHaveLength(1);

    release();
    await session;
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("blocks operations that would race a backend or session transition", async () => {
    const coordinator = new OperationCoordinator();
    let release = (): void => {};
    const transition = coordinator.run(
      { key: "session-transition", id: "session:resume", label: "Resuming session" },
      () => new Promise<void>((resolve) => { release = resolve; }),
    );

    await expect(coordinator.run(
      { key: "session-state", id: "session:model", label: "Changing model" },
      async () => {},
    )).rejects.toMatchObject({ active: expect.objectContaining({ id: "session:resume" }) });
    await expect(coordinator.run(
      { key: "workflow-control", id: "workflow:pause", label: "Pausing workflow" },
      async () => {},
    )).rejects.toMatchObject({ active: expect.objectContaining({ id: "session:resume" }) });

    release();
    await transition;
  });
});
