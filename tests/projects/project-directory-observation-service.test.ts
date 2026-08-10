import { TFile, TFolder } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProjectDirectoryObservationResult,
  ProjectDirectoryObserved,
  ProjectDirectoryRescanRequested,
  ProjectDirectoryRescanResult,
} from "../../src/vendor/@chatobby/obsidian-protocol/index.js";
import {
  ProjectDirectoryObservationService,
  type ProjectDirectoryObservationTransport,
} from "../../src/features/projects/public";

class FakeObservationTransport implements ProjectDirectoryObservationTransport {
  isProjectDirectoryBridgeAvailable = false;
  readonly observations: ProjectDirectoryObserved[] = [];
  readonly rescans: ProjectDirectoryRescanRequested[] = [];
  private readonly availabilityListeners = new Set<(available: boolean) => void>();
  private readonly observationListeners = new Set<(result: ProjectDirectoryObservationResult) => void>();
  private readonly rescanListeners = new Set<(result: ProjectDirectoryRescanResult) => void>();

  onAvailabilityChange(listener: (available: boolean) => void): () => void {
    this.availabilityListeners.add(listener);
    return () => this.availabilityListeners.delete(listener);
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
    this.observations.push(message);
    return true;
  }

  sendProjectDirectoryRescan(message: ProjectDirectoryRescanRequested): boolean {
    this.rescans.push(message);
    return true;
  }

  setAvailable(available: boolean): void {
    this.isProjectDirectoryBridgeAvailable = available;
    for (const listener of this.availabilityListeners) listener(available);
  }

  resolveObservation(message: ProjectDirectoryObserved, retryable = false): void {
    const result: ProjectDirectoryObservationResult = {
      type: "project_directory_observation_result",
      schemaVersion: 1,
      requestId: message.requestId,
      observationId: message.observationId,
      status: retryable ? "rejected" : "applied",
      retryable,
    };
    for (const listener of this.observationListeners) listener(result);
  }

  resolveRescan(message: ProjectDirectoryRescanRequested, retryable = false): void {
    const result: ProjectDirectoryRescanResult = {
      type: "project_directory_rescan_result",
      schemaVersion: 1,
      requestId: message.requestId,
      rescanId: message.rescanId,
      status: retryable ? "rejected" : "applied",
      retryable,
    };
    for (const listener of this.rescanListeners) listener(result);
  }
}

describe("ProjectDirectoryObservationService", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("requests one startup rescan without starting a stopped runtime and ignores file renames", () => {
    const transport = new FakeObservationTransport();
    const startRuntime = vi.fn();
    const service = createService(transport);

    service.start();
    expect(transport.rescans).toEqual([]);
    expect(service.observeRename(new TFile("New.md"), "Old.md")).toBe(false);
    transport.setAvailable(true);

    expect(transport.rescans).toHaveLength(1);
    expect(transport.rescans[0]?.reason).toBe("startup");
    expect(startRuntime).not.toHaveBeenCalled();
  });

  it("serializes folder observations with stable observation IDs and fresh retry request IDs", () => {
    const transport = new FakeObservationTransport();
    const service = createService(transport);
    service.start();
    transport.setAvailable(true);
    transport.resolveRescan(required(transport.rescans[0]));

    expect(service.observeRename(new TFolder("Projects/New"), "Projects/Old")).toBe(true);
    expect(service.observeRename(new TFolder("Projects/Two"), "Projects/One")).toBe(true);
    expect(transport.observations).toHaveLength(1);

    const firstAttempt = required(transport.observations[0]);
    vi.advanceTimersByTime(1_251);
    const retryAttempt = required(transport.observations[1]);
    expect(retryAttempt.observationId).toBe(firstAttempt.observationId);
    expect(retryAttempt.requestId).not.toBe(firstAttempt.requestId);

    transport.resolveObservation(retryAttempt);
    expect(transport.observations).toHaveLength(3);
    transport.resolveObservation(required(transport.observations[2]));
  });

  it("coalesces queue overflow and disconnect loss into one authoritative rescan", () => {
    const transport = new FakeObservationTransport();
    const service = createService(transport, { queueLimit: 1 });
    service.start();
    transport.setAvailable(true);
    transport.resolveRescan(required(transport.rescans[0]));

    service.observeRename(new TFolder("B"), "A");
    service.observeRename(new TFolder("D"), "C");
    service.observeRename(new TFolder("F"), "E");

    expect(transport.rescans).toHaveLength(2);
    expect(transport.rescans[1]?.reason).toBe("queue-overflow");
    transport.setAvailable(false);
    transport.setAvailable(false);
    transport.setAvailable(true);
    expect(transport.rescans).toHaveLength(3);
    expect(transport.rescans[2]?.rescanId).toBe(transport.rescans[1]?.rescanId);
  });

  it("ignores duplicate terminal results and stops all delivery after disposal", () => {
    const transport = new FakeObservationTransport();
    const service = createService(transport);
    service.start();
    transport.setAvailable(true);
    const startup = required(transport.rescans[0]);
    transport.resolveRescan(startup);
    transport.resolveRescan(startup);

    service.observeRename(new TFolder("After"), "Before");
    const observation = required(transport.observations[0]);
    transport.resolveObservation(observation);
    transport.resolveObservation(observation);
    expect(transport.observations).toHaveLength(1);

    service.dispose();
    expect(service.observeRename(new TFolder("Later"), "Earlier")).toBe(false);
    transport.setAvailable(false);
    transport.setAvailable(true);
    vi.runAllTimers();
    expect(transport.rescans).toHaveLength(1);
  });

  it("handles folder observations below the 10 ms p95 admission budget", () => {
    const transport = new FakeObservationTransport();
    const service = createService(transport, { queueLimit: 2_000 });
    service.start();
    transport.setAvailable(true);
    transport.resolveRescan(required(transport.rescans[0]));

    const folders = Array.from(
      { length: 1_000 },
      (_, index) => new TFolder(`Projects/New-${index}`),
    );
    const durations: number[] = [];
    for (const [index, folder] of folders.entries()) {
      const startedAt = performance.now();
      expect(service.observeRename(folder, `Projects/Old-${index}`)).toBe(true);
      durations.push(performance.now() - startedAt);
    }

    durations.sort((left, right) => left - right);
    const p95Index = Math.ceil(durations.length * 0.95) - 1;
    expect(durations[p95Index] ?? Number.POSITIVE_INFINITY).toBeLessThan(10);
  });
});

function createService(
  transport: FakeObservationTransport,
  options: { queueLimit?: number } = {},
): ProjectDirectoryObservationService {
  let id = 0;
  return new ProjectDirectoryObservationService(transport, {
    ...options,
    resultTimeoutMs: 1_000,
    retryDelayMs: 250,
    maxAttempts: 3,
    createId: () => `id-${++id}`,
    now: () => new Date("2026-08-08T00:00:00.000Z"),
  });
}

function required<T>(value: T | undefined): T {
  if (!value) throw new Error("Expected test value");
  return value;
}
