import { describe, expect, it, vi, type Mock } from "vitest";
import { FrontendSessionRegistry } from "../../src/runtime/application/frontend-session-registry";
import type { ReadyRuntime } from "../../src/runtime/contracts";
import type { ChatobbyTransport } from "../../src/transport/ws-client";

describe("FrontendSessionRegistry", () => {
  it("maintains one independently visible transport per registered leaf", async () => {
    const harness = createHarness();
    await harness.registry.register("leaf-a");
    await harness.registry.register("leaf-b");

    await harness.registry.bindRuntime(runtime("runtime-1"));
    const first = harness.transports[0]!;
    const second = harness.transports[1]!;

    expect(harness.transports).toHaveLength(2);
    expect(harness.registry.get("leaf-a")).toBe(first.transport);
    expect(harness.registry.get("leaf-b")).toBe(second.transport);
    expect(first.connect).toHaveBeenCalledOnce();
    expect(second.connect).toHaveBeenCalledOnce();

    await harness.registry.setVisible("leaf-a", true);
    expect(first.setOperatorViewOpen).toHaveBeenLastCalledWith(true);
    expect(second.setOperatorViewOpen).toHaveBeenLastCalledWith(false);

    await harness.registry.unregister("leaf-a");
    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(second.disconnect).not.toHaveBeenCalled();
  });

  it("reattaches every restored leaf after the frontend runtime disconnects", async () => {
    const harness = createHarness();
    await harness.registry.register("leaf-a");
    await harness.registry.register("leaf-b");
    const ready = runtime("runtime-1");
    await harness.registry.bindRuntime(ready);

    await harness.registry.disconnectRuntime();
    await harness.registry.bindRuntime(ready);

    for (const fake of harness.transports) {
      expect(fake.disconnect).toHaveBeenCalledOnce();
      expect(fake.setRuntime).toHaveBeenCalledWith(ready);
      expect(fake.connect).toHaveBeenCalledTimes(2);
      expect(fake.isConnected).toBe(true);
    }
  });

  it("rebinds existing leaf transports when the backend instance changes", async () => {
    const harness = createHarness();
    await harness.registry.register("leaf-a");
    const firstRuntime = runtime("runtime-1");
    const replacementRuntime = runtime("runtime-2");
    await harness.registry.bindRuntime(firstRuntime);

    await harness.registry.bindRuntime(replacementRuntime);

    const fake = harness.transports[0]!;
    expect(fake.setRuntime).toHaveBeenCalledWith(replacementRuntime);
    expect(fake.connect).toHaveBeenCalledTimes(2);
  });
});

interface FakeTransport {
  readonly transport: ChatobbyTransport;
  isConnected: boolean;
  connect: Mock<() => Promise<void>>;
  disconnect: Mock<() => Promise<void>>;
  setRuntime: Mock<(runtime: ReadyRuntime) => Promise<void>>;
  setOperatorViewOpen: Mock<(visible: boolean) => Promise<void>>;
}

function createHarness(): {
  registry: FrontendSessionRegistry;
  transports: FakeTransport[];
} {
  const transports: FakeTransport[] = [];
  const registry = new FrontendSessionRegistry({
    createTransport: () => {
      const fake = createFakeTransport();
      transports.push(fake);
      return fake.transport;
    },
    bindTransport: () => () => {},
  });
  return { registry, transports };
}

function createFakeTransport(): FakeTransport {
  const fake = {
    isConnected: false,
    connect: vi.fn(async () => {
      fake.isConnected = true;
    }),
    disconnect: vi.fn(async () => {
      fake.isConnected = false;
    }),
    setRuntime: vi.fn(async () => {
      fake.isConnected = false;
    }),
    setOperatorViewOpen: vi.fn(async () => {}),
  };
  Object.defineProperty(fake, "transport", {
    get: () => fake as unknown as ChatobbyTransport,
  });
  return fake as unknown as FakeTransport;
}

function runtime(instanceId: string): ReadyRuntime {
  return {
    identity: {
      instanceId,
      vaultId: "vault-1",
      pid: 100,
      startedAt: 1,
      runtimeVersion: "test",
      protocolVersion: 1,
    },
    endpoint: "ws://127.0.0.1:43125",
    ownership: "managed",
  };
}
