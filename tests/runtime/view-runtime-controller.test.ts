import { describe, expect, it, vi } from "vitest";
import { ViewRuntimeController } from "../../src/runtime/application/view-runtime-controller";
import type { ReadyRuntime, RuntimeDemandHandle, RuntimeDemandKind } from "../../src/runtime/public";

describe("ViewRuntimeController", () => {
  it("acquires visible demand once, starts asynchronously, and releases without stopping", async () => {
    const demand = demandHandle("visible-view");
    const ensureRuntime = vi.fn(async () => readyRuntime());
    const controller = new ViewRuntimeController({
      shouldAutoStart: () => true,
      acquireDemand: vi.fn(() => demand),
      ensureRuntime,
      getTransport: () => null,
      onStateChange: () => () => {},
      handleStateChange: () => {},
    });

    controller.open();
    await vi.waitFor(() => expect(ensureRuntime).toHaveBeenCalledWith("view-open"));
    controller.close();
    controller.close();

    expect(demand.release).toHaveBeenCalledOnce();
  });

  it("wraps user-action readiness in an idempotently released action demand", async () => {
    const demand = demandHandle("pending-user-action");
    const acquireDemand = vi.fn(() => demand);
    const transport = { isConnected: true };
    const controller = new ViewRuntimeController({
      shouldAutoStart: () => false,
      acquireDemand,
      ensureRuntime: vi.fn(async () => readyRuntime()),
      getTransport: () => transport as never,
      onStateChange: () => () => {},
      handleStateChange: () => {},
    });

    await expect(controller.ensureTransport()).resolves.toBe(transport);
    expect(acquireDemand).toHaveBeenCalledWith("pending-user-action", expect.any(String));
    expect(demand.release).toHaveBeenCalledOnce();
  });
});

function demandHandle(kind: RuntimeDemandKind): RuntimeDemandHandle {
  return { id: `${kind}:test`, kind, release: vi.fn() };
}

function readyRuntime(): ReadyRuntime {
  return {
    endpoint: "ws://127.0.0.1:43125",
    ownership: "managed",
    identity: {
      instanceId: "runtime-1",
      vaultId: "vault-1",
      pid: 1,
      startedAt: 1,
      runtimeVersion: "0.1.0",
      protocolVersion: 1,
    },
  };
}
