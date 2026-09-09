import { describe, expect, it, vi } from "vitest";
import type ChatobbyPlugin from "../../src/main";
import { WorkspaceConnection } from "../../src/ui/workspace/workspace-connection";

const protocol = vi.hoisted(() => ({ bind: vi.fn(), synchronize: vi.fn(async () => {}), destroy: vi.fn(), clearNegotiatedCapabilities: vi.fn() }));
vi.mock("../../src/frontend/frontend-protocol-controller", () => ({ FrontendProtocolController: class { bind = protocol.bind; synchronize = protocol.synchronize; destroy = protocol.destroy; clearNegotiatedCapabilities = protocol.clearNegotiatedCapabilities; } }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("workspace connection lifecycle", () => {
  it("unregisters after an in-flight registration and never binds a closed page", async () => {
    const registration = deferred();
    const unsubscribe = vi.fn();
    const plugin = {
      onRuntimeStateChange: vi.fn(() => unsubscribe),
      registerWorkspaceChannel: vi.fn(() => registration.promise),
      ensureWorkspaceChannel: vi.fn(),
      unregisterWorkspaceChannel: vi.fn(async () => {}),
    };
    const ready = vi.fn();
    const connection = new WorkspaceConnection(plugin as unknown as ChatobbyPlugin, ready, vi.fn());
    const opening = connection.open();
    expect(connection.open()).toBe(opening);
    const closing = connection.close();
    expect(plugin.unregisterWorkspaceChannel).not.toHaveBeenCalled();
    registration.resolve();
    await Promise.all([opening, closing]);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(plugin.ensureWorkspaceChannel).not.toHaveBeenCalled();
    expect(plugin.unregisterWorkspaceChannel).toHaveBeenCalledExactlyOnceWith(connection.channelId);
    expect(ready).not.toHaveBeenCalled();
  });

  it("coalesces concurrent connects and discards a transport that arrives after close", async () => {
    const pending = deferred();
    const transport = { onConnectionChange: vi.fn(() => vi.fn()) };
    const plugin = {
      ensureWorkspaceChannel: vi.fn(async () => { await pending.promise; return transport; }),
      unregisterWorkspaceChannel: vi.fn(async () => {}),
    };
    protocol.bind.mockClear();
    const connection = new WorkspaceConnection(plugin as unknown as ChatobbyPlugin, vi.fn(), vi.fn());
    const first = connection.connect();
    const second = connection.connect();
    const closing = connection.close();
    pending.resolve();
    await Promise.all([first, second, closing]);
    expect(plugin.ensureWorkspaceChannel).toHaveBeenCalledOnce();
    expect(protocol.bind).not.toHaveBeenCalled();
    expect(transport.onConnectionChange).not.toHaveBeenCalled();
    expect(plugin.unregisterWorkspaceChannel).toHaveBeenCalledOnce();
  });
});
