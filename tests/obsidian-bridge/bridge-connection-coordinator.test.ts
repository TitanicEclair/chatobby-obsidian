import { describe, expect, it, vi } from "vitest";
import type {
  ObsidianBridgeConnectionConfig,
  ProjectDirectoryObservationResult,
  ProjectDirectoryObserved,
  ProjectDirectoryRescanRequested,
  ProjectDirectoryRescanResult,
} from "../../src/vendor/@chatobby/obsidian-protocol/index.js";
import {
  BridgeConnectionCoordinator,
  type CoordinatedBridgeClient,
} from "../../src/obsidian-bridge/bridge-connection-coordinator";
import type { BridgeConnectionState } from "../../src/obsidian-bridge/types";

class FakeBridgeClient implements CoordinatedBridgeClient {
  isReady = false;
  readonly connect = vi.fn(async () => undefined);
  readonly reconfigure = vi.fn(async (_config: ObsidianBridgeConnectionConfig) => undefined);
  readonly disconnect = vi.fn(async () => undefined);
  readonly sentObservations: ProjectDirectoryObserved[] = [];
  readonly sentRescans: ProjectDirectoryRescanRequested[] = [];
  private readonly connectionListeners = new Set<(state: BridgeConnectionState) => void>();
  private readonly observationListeners = new Set<(result: ProjectDirectoryObservationResult) => void>();
  private readonly rescanListeners = new Set<(result: ProjectDirectoryRescanResult) => void>();

  onConnectionChange(listener: (state: BridgeConnectionState) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onProjectDirectoryObservationResult(
    listener: (result: ProjectDirectoryObservationResult) => void,
  ): () => void {
    this.observationListeners.add(listener);
    return () => this.observationListeners.delete(listener);
  }

  onProjectDirectoryRescanResult(listener: (result: ProjectDirectoryRescanResult) => void): () => void {
    this.rescanListeners.add(listener);
    return () => this.rescanListeners.delete(listener);
  }

  sendProjectDirectoryObservation(message: ProjectDirectoryObserved): boolean {
    this.sentObservations.push(message);
    return true;
  }

  sendProjectDirectoryRescan(message: ProjectDirectoryRescanRequested): boolean {
    this.sentRescans.push(message);
    return true;
  }

  emitReady(ready: boolean): void {
    this.isReady = ready;
    const state: BridgeConnectionState = ready
      ? { status: "ready", url: "ws://bridge", token: "redacted", reconnectAttempt: 0 }
      : { status: "disconnected", url: "ws://bridge", token: "redacted", reconnectAttempt: 0 };
    for (const listener of this.connectionListeners) listener(state);
  }
}

describe("BridgeConnectionCoordinator", () => {
  it("keeps one client while newer view ownership wins and removal promotes the previous owner", async () => {
    const clients: FakeBridgeClient[] = [];
    const coordinator = new BridgeConnectionCoordinator((config) => {
      const client = new FakeBridgeClient();
      clients.push(client);
      expect(config.vaultId).toBe("vault-1");
      return client;
    });
    const first = config("token-a", "C:/Vault");
    const second = config("token-b", "C:/Vault");

    await coordinator.setOwnerConfig("view-a", first);
    await coordinator.setOwnerConfig("view-b", second);

    expect(clients).toHaveLength(1);
    expect(clients[0]?.connect).toHaveBeenCalledTimes(1);
    expect(clients[0]?.reconfigure).toHaveBeenLastCalledWith(second);

    await coordinator.removeOwner("view-b");
    expect(clients[0]?.reconfigure).toHaveBeenLastCalledWith(first);
    expect(clients[0]?.disconnect).not.toHaveBeenCalled();

    await coordinator.removeOwner("view-a");
    expect(clients[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("forwards readiness once and does not invoke any runtime-start callback", async () => {
    const client = new FakeBridgeClient();
    const startRuntime = vi.fn();
    const coordinator = new BridgeConnectionCoordinator(() => client);
    const availability: boolean[] = [];
    coordinator.onAvailabilityChange((ready) => availability.push(ready));

    await coordinator.setOwnerConfig("view-a", config("token-a", "C:/Vault"));
    client.emitReady(true);
    client.emitReady(true);
    await coordinator.clearOwners();

    expect(availability).toEqual([true, false]);
    expect(startRuntime).not.toHaveBeenCalled();
  });
});

function config(token: string, vaultRoot: string): ObsidianBridgeConnectionConfig {
  return {
    type: "bridge_config",
    schemaVersion: 1,
    url: "ws://127.0.0.1:8765/bridge",
    token,
    protocolVersion: 2,
    vaultId: "vault-1",
    vaultRoot,
  };
}
