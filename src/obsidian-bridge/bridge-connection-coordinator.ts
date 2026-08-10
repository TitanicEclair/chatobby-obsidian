import type {
  ObsidianBridgeConnectionConfig,
  ProjectDirectoryObservationResult,
  ProjectDirectoryObserved,
  ProjectDirectoryRescanRequested,
  ProjectDirectoryRescanResult,
} from "../vendor/@chatobby/obsidian-protocol/index.js";
import type { BridgeConnectionState } from "./types";

/** The bridge-client surface coordinated across all Chatobby views. */
export interface CoordinatedBridgeClient {
  readonly isReady: boolean;
  connect(): Promise<void>;
  reconfigure(config: ObsidianBridgeConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  onConnectionChange(listener: (state: BridgeConnectionState) => void): () => void;
  onProjectDirectoryObservationResult(
    listener: (result: ProjectDirectoryObservationResult) => void,
  ): () => void;
  onProjectDirectoryRescanResult(listener: (result: ProjectDirectoryRescanResult) => void): () => void;
  sendProjectDirectoryObservation(message: ProjectDirectoryObserved): boolean;
  sendProjectDirectoryRescan(message: ProjectDirectoryRescanRequested): boolean;
}

export type BridgeClientFactory = (config: ObsidianBridgeConnectionConfig) => CoordinatedBridgeClient;

interface OwnedBridgeConfig {
  ownerId: string;
  sequence: number;
  config: ObsidianBridgeConnectionConfig;
}

/**
 * Owns the plugin-global Obsidian bridge connection. View transports contribute
 * configurations, but only the newest still-live owner controls one client.
 */
export class BridgeConnectionCoordinator {
  private readonly owners = new Map<string, OwnedBridgeConfig>();
  private readonly availabilityListeners = new Set<(available: boolean) => void>();
  private readonly observationResultListeners = new Set<
    (result: ProjectDirectoryObservationResult) => void
  >();
  private readonly rescanResultListeners = new Set<(result: ProjectDirectoryRescanResult) => void>();
  private sequence = 0;
  private client: CoordinatedBridgeClient | null = null;
  private active: OwnedBridgeConfig | null = null;
  private clientUnsubscribes: Array<() => void> = [];
  private reconcileTail: Promise<void> = Promise.resolve();
  private available = false;
  private disposed = false;

  constructor(private readonly createClient: BridgeClientFactory) {}

  /** Register or replace one view transport's validated bridge configuration. */
  setOwnerConfig(ownerId: string, config: ObsidianBridgeConnectionConfig): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.owners.set(ownerId, { ownerId, config, sequence: ++this.sequence });
    return this.enqueueReconcile();
  }

  /** Remove one view transport and promote the newest remaining owner. */
  removeOwner(ownerId: string): Promise<void> {
    this.owners.delete(ownerId);
    return this.enqueueReconcile();
  }

  /** Remove all view ownership without requesting that the runtime start. */
  clearOwners(): Promise<void> {
    this.owners.clear();
    return this.enqueueReconcile();
  }

  /** Report whether the coordinated bridge can currently deliver Project messages. */
  get isProjectDirectoryBridgeAvailable(): boolean {
    return this.available;
  }

  /** Subscribe to whether the one coordinated bridge client is ready. */
  onAvailabilityChange(listener: (available: boolean) => void): () => void {
    this.availabilityListeners.add(listener);
    return () => this.availabilityListeners.delete(listener);
  }

  /** Subscribe to Project directory observation receipts. */
  onProjectDirectoryObservationResult(
    listener: (result: ProjectDirectoryObservationResult) => void,
  ): () => void {
    this.observationResultListeners.add(listener);
    return () => this.observationResultListeners.delete(listener);
  }

  /** Subscribe to Project directory rescan receipts. */
  onProjectDirectoryRescanResult(listener: (result: ProjectDirectoryRescanResult) => void): () => void {
    this.rescanResultListeners.add(listener);
    return () => this.rescanResultListeners.delete(listener);
  }

  /** Send one folder observation only when the coordinated bridge is ready. */
  sendProjectDirectoryObservation(message: ProjectDirectoryObserved): boolean {
    return this.client?.isReady === true && this.client.sendProjectDirectoryObservation(message);
  }

  /** Send one authoritative-rescan request only when the bridge is ready. */
  sendProjectDirectoryRescan(message: ProjectDirectoryRescanRequested): boolean {
    return this.client?.isReady === true && this.client.sendProjectDirectoryRescan(message);
  }

  /** Disconnect the coordinated client and reject future ownership updates. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.owners.clear();
    await this.enqueueReconcile();
    this.availabilityListeners.clear();
    this.observationResultListeners.clear();
    this.rescanResultListeners.clear();
  }

  private enqueueReconcile(): Promise<void> {
    this.reconcileTail = this.reconcileTail
      .catch(() => undefined)
      .then(() => this.reconcile());
    return this.reconcileTail;
  }

  private async reconcile(): Promise<void> {
    const desired = newestOwner(this.owners);
    if (!desired || this.disposed) {
      await this.releaseClient();
      return;
    }

    if (!this.client) {
      const client = this.createClient(desired.config);
      this.client = client;
      this.active = desired;
      this.bindClient(client);
      await client.connect();
      return;
    }

    if (this.active?.sequence === desired.sequence) return;
    this.active = desired;
    await this.client.reconfigure(desired.config);
  }

  private bindClient(client: CoordinatedBridgeClient): void {
    this.clientUnsubscribes = [
      client.onConnectionChange((state) => {
        if (state.status === "error") {
          console.error(`Chatobby bridge: connection error: ${state.error ?? "unknown error"}`);
        }
        this.setAvailable(state.status === "ready");
      }),
      client.onProjectDirectoryObservationResult((result) => {
        for (const listener of this.observationResultListeners) listener(result);
      }),
      client.onProjectDirectoryRescanResult((result) => {
        for (const listener of this.rescanResultListeners) listener(result);
      }),
    ];
  }

  private async releaseClient(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.active = null;
    for (const unsubscribe of this.clientUnsubscribes.splice(0)) unsubscribe();
    this.setAvailable(false);
    if (client) await client.disconnect().catch(() => undefined);
  }

  private setAvailable(available: boolean): void {
    if (this.available === available) return;
    this.available = available;
    for (const listener of this.availabilityListeners) listener(available);
  }
}

function newestOwner(owners: ReadonlyMap<string, OwnedBridgeConfig>): OwnedBridgeConfig | null {
  let newest: OwnedBridgeConfig | null = null;
  for (const owner of owners.values()) {
    if (!newest || owner.sequence > newest.sequence) newest = owner;
  }
  return newest;
}
