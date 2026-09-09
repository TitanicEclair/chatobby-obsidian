import { describe, expect, it, vi } from "vitest";
import { RuntimeBootstrapCoordinator } from "../../src/runtime/public";

describe("RuntimeBootstrapCoordinator", () => {
  it("joins concurrent bootstrap callers and provisions once", async () => {
    let finish!: () => void;
    const ensureRequiredRuntime = vi.fn(() => new Promise<"installed">((resolve) => {
      finish = () => resolve("installed");
    }));
    const coordinator = new RuntimeBootstrapCoordinator({
      enabled: true,
      hasInstalledRuntime: () => false,
      shouldStartRuntime: () => true,
      reattachCompatibleRuntime: vi.fn(),
      ensureRequiredRuntime,
      stopProvisionedRuntime: vi.fn(),
      reportFailure: vi.fn(),
    });

    const first = coordinator.start();
    const second = coordinator.start();
    expect(first).toBe(second);
    expect(ensureRequiredRuntime).toHaveBeenCalledOnce();
    finish();
    await first;
  });

  it("reattaches a compatible installed runtime before reconciling its exact pair", async () => {
    const order: string[] = [];
    const coordinator = new RuntimeBootstrapCoordinator({
      enabled: true,
      hasInstalledRuntime: () => true,
      shouldStartRuntime: () => true,
      reattachCompatibleRuntime: async () => { order.push("reattach"); },
      ensureRequiredRuntime: async () => { order.push("ensure"); return "current"; },
      stopProvisionedRuntime: vi.fn(),
      reportFailure: vi.fn(),
    });

    await coordinator.start();
    expect(order).toEqual(["reattach", "ensure"]);
  });

  it("defers activation and schedules one bounded retry while work remains active", async () => {
    const scheduled: Array<() => void> = [];
    const ensureRequiredRuntime = vi.fn()
      .mockResolvedValueOnce("deferred")
      .mockResolvedValueOnce("installed");
    const coordinator = new RuntimeBootstrapCoordinator({
      enabled: true,
      hasInstalledRuntime: () => false,
      shouldStartRuntime: () => true,
      reattachCompatibleRuntime: vi.fn(),
      ensureRequiredRuntime,
      stopProvisionedRuntime: vi.fn(),
      reportFailure: vi.fn(),
      schedule: (operation) => { scheduled.push(operation); return 1; },
      cancelScheduled: vi.fn(),
    });

    await coordinator.start();
    expect(scheduled).toHaveLength(1);
    scheduled[0]?.();
    await vi.waitFor(() => expect(ensureRequiredRuntime).toHaveBeenCalledTimes(2));
  });

  it("does nothing when the approval-gated behavior is disabled", async () => {
    const ensureRequiredRuntime = vi.fn();
    const coordinator = new RuntimeBootstrapCoordinator({
      enabled: false,
      hasInstalledRuntime: () => false,
      shouldStartRuntime: () => true,
      reattachCompatibleRuntime: vi.fn(),
      ensureRequiredRuntime,
      stopProvisionedRuntime: vi.fn(),
      reportFailure: vi.fn(),
    });

    await coordinator.start();
    expect(ensureRequiredRuntime).not.toHaveBeenCalled();
  });

  it("reconciles program files without leaving the runtime started when auto-start is disabled", async () => {
    const reattachCompatibleRuntime = vi.fn();
    const stopProvisionedRuntime = vi.fn(async () => {});
    const coordinator = new RuntimeBootstrapCoordinator({
      enabled: true,
      hasInstalledRuntime: () => true,
      shouldStartRuntime: () => false,
      reattachCompatibleRuntime,
      ensureRequiredRuntime: vi.fn(async () => "installed"),
      stopProvisionedRuntime,
      reportFailure: vi.fn(),
    });

    await coordinator.start();

    expect(reattachCompatibleRuntime).not.toHaveBeenCalled();
    expect(stopProvisionedRuntime).toHaveBeenCalledOnce();
  });
});
