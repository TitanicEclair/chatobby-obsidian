import { describe, expect, it, vi } from "vitest";
import { verifyDevelopmentPairFrontendBootstrap } from "../../src/runtime/application/development-pair-bootstrap";
import type { ReadyRuntime } from "../../src/runtime/public";
import type {
  FrontendBootstrap,
  FrontendNegotiationRequest,
  FrontendSubscriptionResult,
} from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { parseFrontendSubscriptionResult } from "../../src/vendor/chatobby-client/frontend-contracts.js";

describe("development pair frontend bootstrap", () => {
  it("returns exact proof only after authenticated negotiation and fresh bootstrap", async () => {
    const activateFrontendLive = vi.fn();
    const transport = {
      isConnected: true,
      negotiateFrontend: vi.fn(async () => negotiation()),
      subscribeFrontend: vi.fn(async () => subscription()),
      activateFrontendLive,
    };

    await expect(verifyDevelopmentPairFrontendBootstrap({
      pairId: "a".repeat(64),
      runtime: runtime(),
      transport,
      request: request(),
      timeoutMs: 20_000,
      signal: new AbortController().signal,
      now: () => new Date("2026-09-04T00:00:00.000Z"),
    })).resolves.toEqual({
      status: "frontend-bootstrap-complete",
      pairId: "a".repeat(64),
      runtimeInstanceId: "runtime-1",
      frontendProtocolVersion: 2,
      viewId: "development-pair-view",
      selectedCapabilities: [...protocolCapabilities],
      subscriptionStatus: "bootstrapped",
      subscriptionSequence: 4,
      subscriptionRevision: 3,
      bootstrapRuntimeInstanceId: "runtime-1",
      bootstrapViewId: "development-pair-view",
      bootstrapSequence: 4,
      bootstrapRevision: 3,
      completedAt: "2026-09-04T00:00:00.000Z",
      timeoutMs: 20_000,
    });
    expect(activateFrontendLive).toHaveBeenCalledOnce();
  });

  it("rejects a missing required capability before subscribing", async () => {
    const transport = {
      isConnected: true,
      negotiateFrontend: vi.fn(async () => ({ ...negotiation(), selectedCapabilities: ["atomic-bootstrap-cutover"] })),
      subscribeFrontend: vi.fn(async () => subscription()),
      activateFrontendLive: vi.fn(),
    };

    await expect(verifyDevelopmentPairFrontendBootstrap({
      pairId: "a".repeat(64),
      runtime: runtime(),
      transport,
      request: request(),
      timeoutMs: 20_000,
      signal: new AbortController().signal,
    })).rejects.toThrow("omitted required capability");
    expect(transport.subscribeFrontend).not.toHaveBeenCalled();
  });

  it("rejects a fractional effective compaction threshold before activating the pair", async () => {
    const activateFrontendLive = vi.fn();
    const transport = {
      isConnected: true,
      negotiateFrontend: vi.fn(async () => negotiation()),
      subscribeFrontend: vi.fn(async () => subscription(68.5)),
      activateFrontendLive,
    };

    await expect(verifyDevelopmentPairFrontendBootstrap({
      pairId: "a".repeat(64),
      runtime: runtime(),
      transport,
      request: request(),
      timeoutMs: 20_000,
      signal: new AbortController().signal,
    })).rejects.toThrow("session.autoCompaction.effectiveThresholdPercent must be a non-negative safe integer");
    expect(activateFrontendLive).not.toHaveBeenCalled();
  });

  it("rejects replay instead of accepting it as a fresh bootstrap", async () => {
    const replayed: FrontendSubscriptionResult = {
      schemaVersion: 1,
      protocolVersion: 2,
      requestId: "subscribe-1",
      runtimeInstanceId: "runtime-1",
      viewId: "development-pair-view",
      sequence: 4,
      revision: 3,
      oldestReplayableSequence: 0,
      status: "replayed",
      baseSequence: 4,
      baseRevision: 3,
      replay: [],
    };
    const transport = {
      isConnected: true,
      negotiateFrontend: vi.fn(async () => negotiation()),
      subscribeFrontend: vi.fn(async () => replayed),
      activateFrontendLive: vi.fn(),
    };

    await expect(verifyDevelopmentPairFrontendBootstrap({
      pairId: "a".repeat(64),
      runtime: runtime(),
      transport,
      request: request(),
      timeoutMs: 20_000,
      signal: new AbortController().signal,
    })).rejects.toThrow("did not return a fresh bootstrap");
    expect(transport.activateFrontendLive).not.toHaveBeenCalled();
  });

  it("does not activate a late bootstrap after the bounded operation is aborted", async () => {
    const controller = new AbortController();
    const transport = {
      isConnected: true,
      negotiateFrontend: vi.fn(async () => {
        controller.abort(new Error("bounded timeout"));
        return negotiation();
      }),
      subscribeFrontend: vi.fn(async () => subscription()),
      activateFrontendLive: vi.fn(),
    };

    await expect(verifyDevelopmentPairFrontendBootstrap({
      pairId: "a".repeat(64),
      runtime: runtime(),
      transport,
      request: request(),
      timeoutMs: 20_000,
      signal: controller.signal,
    })).rejects.toThrow("bounded timeout");
    expect(transport.subscribeFrontend).not.toHaveBeenCalled();
    expect(transport.activateFrontendLive).not.toHaveBeenCalled();
  });
});

function runtime(): ReadyRuntime {
  return {
    identity: {
      instanceId: "runtime-1",
      vaultId: "vault-1",
      pid: 1,
      startedAt: 1,
      runtimeVersion: "0.4.3",
      protocolVersion: 4,
      runtimePackageFingerprint: null,
      developmentBuildFingerprint: "b".repeat(64),
    },
    endpoint: "ws://127.0.0.1:1",
    ownership: "managed",
  };
}

function request(): FrontendNegotiationRequest {
  return {
    schemaVersion: 1,
    requestId: "negotiate-1",
    connectorVersion: "0.4.3",
    obsidianVersion: "1.13.1",
    vaultInstanceId: "vault-1",
    viewId: "development-pair-view",
    supportedProtocolVersions: [2],
    capabilities: { featureFamilies: [], protocolCapabilities, integrations: [] },
  };
}

function negotiation() {
  return {
    schemaVersion: 1 as const,
    protocolVersion: 2 as const,
    requestId: "negotiate-1",
    runtimeInstanceId: "runtime-1",
    viewId: "development-pair-view",
    selectedCapabilities: [...protocolCapabilities],
    unavailableCapabilities: [],
    replayLimit: 256,
  };
}

function subscription(
  effectiveThresholdPercent = 68,
): Extract<FrontendSubscriptionResult, { status: "bootstrapped" }> {
  const parsed = parseFrontendSubscriptionResult({
    schemaVersion: 1,
    protocolVersion: 2,
    requestId: "subscribe-1",
    runtimeInstanceId: "runtime-1",
    viewId: "development-pair-view",
    sequence: 4,
    revision: 3,
    oldestReplayableSequence: 0,
    status: "bootstrapped",
    bootstrap: bootstrap(effectiveThresholdPercent),
    replay: [],
  });
  if (parsed.status !== "bootstrapped") throw new Error("Expected a bootstrapped test subscription");
  return parsed;
}

function bootstrap(effectiveThresholdPercent = 68): FrontendBootstrap {
  return {
    schemaVersion: 1,
    protocolVersion: 2,
    runtimeInstanceId: "runtime-1",
    revision: 3,
    sequence: 4,
    viewId: "development-pair-view",
    session: {
      id: "session-1",
      workingDirectory: "C:/vault",
      workspace: { kind: "vault", label: "Test vault" },
      model: "zai/glm-4.7",
      thinkingLevel: "medium",
      streaming: false,
      compacting: false,
      retrying: false,
      autoCompaction: {
        enabled: true,
        thresholdPercent: 87,
        effectiveThresholdPercent,
      },
      messageCount: 0,
      forkOptions: [],
    },
    taskPlan: { revision: 0, completedCount: 0, remainingCount: 0, summary: "No tracked tasks", items: [] },
    composer: { controls: [], canSubmit: true },
    agentRail: { items: [] },
    feed: { revision: 0, blocks: [] },
    screens: [],
    screenModels: [],
    localCommands: [],
  };
}

const protocolCapabilities = [
  "atomic-bootstrap-cutover",
  "bounded-replay",
  "typed-protocol-errors",
  "revisioned-screen-cache",
  "complete-feed-entities",
  "session-clear",
  "pagination-v2",
  "intent-outcomes-v2",
] as const;
