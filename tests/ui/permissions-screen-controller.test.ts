import { Notice } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";
import { PermissionsScreenController } from "../../src/ui/screens/permissions-screen-controller";
import type { FrontendBootstrap, FrontendIntent, FrontendIntentResult, FrontendPermissionScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";

vi.mock("obsidian", { spy: true });
beforeEach(() => vi.clearAllMocks());

const grantIntent = {
  type: "permissions.set-obsidian-vault-access",
  payload: { expectedRevision: 7, expectedSessionId: "session-a", expectedBindingRevision: 4, enabled: true },
} as const;

function fixture(sessionId = "session-a", projectId = "project-a", viewId = "view-a") {
  const store = new FrontendStore();
  const snapshot: FrontendBootstrap = {
    schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime-a", viewId, revision: 0, sequence: 0,
    session: { id: sessionId, name: "Synthetic", workingDirectory: ".", workspace: { kind: "project", projectId, label: "Synthetic Project" },
      model: "synthetic/model", thinkingLevel: "off", streaming: false, compacting: false, retrying: false, messageCount: 0, forkOptions: [] },
    composer: { controls: [], canSubmit: true }, agentRail: { items: [] }, feed: { revision: 0, blocks: [] },
    taskPlan: { revision: 0, completedCount: 0, remainingCount: 0, summary: "No tracked tasks", items: [] },
    screens: [], screenModels: [policyScreen(sessionId)], localCommands: [],
  };
  store.replace(snapshot);
  const dispatch = vi.fn<(intent: FrontendIntent) => Promise<FrontendIntentResult>>(async (intent) => ({
    schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime-a", viewId, intentId: intent.intentId, status: "applied", revision: 1,
  }));
  const supportsCapability = vi.fn(() => true);
  const loadScreen = vi.fn(async () => policyScreen(sessionId));
  const protocol = { dispatch, supportsCapability, loadScreen } as unknown as FrontendProtocolController;
  const controller = new PermissionsScreenController({ getStore: () => store, getProtocol: () => protocol,
    getHost: () => document.body, prepareOpen: () => {}, onOpened: () => {}, onClosed: () => {} });
  return { controller, store, snapshot, dispatch, supportsCapability, loadScreen };
}

function policyScreen(
  sessionId: string,
  accessMode: FrontendPermissionScreenViewModel["accessPolicy"]["accessMode"] = "workspace",
  agentNetworkAccess = true,
  revision = 7,
): FrontendPermissionScreenViewModel {
  return { screenId: "permissions", accessPolicySessionId: sessionId, revision: 1, loading: false,
    accessPolicy: { schemaVersion: 1, revision, accessMode, agentNetworkAccess },
    scope: { kind: "project", bindingRevision: 4, selectedRootCount: 1, filesystemBound: true },
    nativeSupport: { status: "unverified" },
    effective: { fileRead: false, fileWrite: false, localProcess: "unavailable", obsidian: "unavailable", agentNetworkAccess } };
}

const policyIntent = { type: "permissions.set-access-policy", mainSessionId: "session-a",
  payload: { expectedRevision: 7, accessMode: "read-only", agentNetworkAccess: false } } as const;

describe("session access policy routing", () => {
  it("retains newer session/view state after a deferred reload fails through the actual page caller", async () => {
    const f = fixture();
    f.controller.open();
    await vi.waitFor(() => expect(f.loadScreen).toHaveBeenCalledOnce());
    const view = f.controller["view"];
    if (!view) throw new Error("Synthetic Permissions view missing");
    let reject!: (error: Error) => void;
    f.loadScreen.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const pending = view["refresh"]();
    f.store.replace({ ...f.snapshot, session: { ...f.snapshot.session!, id: "session-b" }, screenModels: [policyScreen("session-b")] });
    view.setLocalError("Current session B notice.");
    reject(new Error("Previous session A load failed."));
    await pending;
    expect(document.body.textContent).toContain("Current session B notice.");
    expect(document.body.textContent).not.toContain("Previous session A load failed.");
    f.loadScreen.mockRejectedValueOnce(new Error("Current session B load failed."));
    await view["refresh"]();
    expect(document.body.textContent).toContain("Current session B load failed.");
    f.loadScreen.mockRejectedValueOnce(new Error("Current session B load failed."));
    await view["refresh"]();
    expect(document.body.textContent).toContain("Current session B load failed.");
    let resolve!: (model: FrontendPermissionScreenViewModel) => void;
    f.loadScreen.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const earlier = view["refresh"]();
    f.store.replace({ ...f.snapshot, session: { ...f.snapshot.session!, id: "session-b" },
      screenModels: [policyScreen("session-b", "read-only", false, 8)] });
    view.setLocalError("Newer same-session notice.");
    resolve(policyScreen("session-b"));
    await earlier;
    expect(document.body.textContent).toContain("Newer same-session notice.");
    f.loadScreen.mockResolvedValueOnce(policyScreen("session-b", "read-only", false, 8));
    await view["refresh"]();
    expect(document.body.textContent).not.toContain("Newer same-session notice.");
    f.controller.destroy();
    expect(f.dispatch).not.toHaveBeenCalled();
  });
  it.each(["project-a", "project-b"])("keeps distinct sessions independent when the sibling uses %s", async (projectId) => {
    const a = fixture(), b = fixture("session-b", projectId, "view-b");
    const sibling = b.store.snapshot;
    await a.controller["dispatch"](policyIntent);
    expect(a.dispatch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ ...policyIntent, viewId: "view-a" }));
    expect(b.dispatch).not.toHaveBeenCalled();
    expect(a.store.snapshot?.screenModels).toEqual([policyScreen("session-a")]);
    a.store.replace({ ...a.snapshot, screenModels: [policyScreen("session-a", "read-only", false, 8)] });
    expect(b.store.snapshot).toBe(sibling);
    expect(b.controller["currentModel"]()?.accessPolicy).toEqual(policyScreen("session-b").accessPolicy);
    expect(a.dispatch.mock.calls[0]?.[0].payload).not.toHaveProperty("projectId");
  });

  it("renders the same durable session's authoritative update in both attached tabs", async () => {
    const a = fixture(), sameSession = fixture("session-a", "project-a", "view-b");
    await a.controller["dispatch"](policyIntent);
    const acknowledged = policyScreen("session-a", "read-only", false, 8);
    a.store.replace({ ...a.snapshot, screenModels: [acknowledged] });
    sameSession.store.replace({ ...sameSession.snapshot, screenModels: [acknowledged] });
    expect(a.controller["currentModel"]()?.accessPolicy).toEqual(acknowledged.accessPolicy);
    expect(sameSession.controller["currentModel"]()?.accessPolicy).toEqual(acknowledged.accessPolicy);
    expect(sameSession.dispatch).not.toHaveBeenCalled();
  });

  it("uses the runtime's reopened policy without writing a connector default", () => {
    const reopened = fixture("session-a", "project-a", "reopened-view");
    const saved = policyScreen("session-a", "read-only", false, 19);
    reopened.store.replace({ ...reopened.snapshot, screenModels: [saved] });
    expect(reopened.controller["currentModel"]()).toBe(saved);
    expect(reopened.dispatch).not.toHaveBeenCalled();
  });

  it.each(["session", "screen-session", "policy", "loading"])("rejects a rendered control after %s changes without routing it to a sibling", async (change) => {
    const f = fixture();
    f.store.replace({ ...f.snapshot,
      session: change === "session" ? { ...f.snapshot.session!, id: "session-b" } : f.snapshot.session,
      screenModels: [{ ...policyScreen(change === "screen-session" || change === "session" ? "session-b" : "session-a",
        "workspace", true, change === "policy" ? 8 : 7), loading: change === "loading" }] });
    await expect(f.controller["dispatch"](policyIntent)).rejects.toThrow("active chat or its access policy changed");
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it.each(["applied", "conflict", "transport-error"])("does not apply a late %s outcome to a replacement session", async (status) => {
    const f = fixture();
    let settle!: () => void;
    f.dispatch.mockImplementationOnce((intent) => new Promise((resolve, reject) => {
      settle = () => {
        if (status === "transport-error") return reject(new Error("Old session transport failed."));
        resolve({ schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime-a", viewId: "view-a", intentId: intent.intentId,
          ...(status === "applied" ? { status: "applied", revision: 1 } : { status: "conflict", actualRevision: 8 }),
          notice: { level: "warning", message: "Old session warning." } });
      };
    }));
    const pending = f.controller["dispatch"](policyIntent);
    await vi.waitFor(() => expect(f.dispatch).toHaveBeenCalledOnce());
    f.store.replace({ ...f.snapshot, session: { ...f.snapshot.session!, id: "session-b" }, screenModels: [policyScreen("session-b")] });
    const replacement = f.store.snapshot;
    settle();
    await expect(pending).resolves.toBeUndefined();
    expect(f.store.snapshot).toBe(replacement);
    expect(Notice).not.toHaveBeenCalled();
    expect(f.dispatch).toHaveBeenCalledTimes(1);
  });

  it("shows the current session's saved warning without rejecting or locally overwriting policy", async () => {
    const f = fixture();
    f.dispatch.mockImplementationOnce(async (intent) => ({ schemaVersion: 1, protocolVersion: 2,
      runtimeInstanceId: "runtime-a", viewId: "view-a", intentId: intent.intentId, status: "applied", revision: 1,
      notice: { level: "warning", message: "Saved; constrained-tool cleanup is incomplete." } }));
    const before = f.store.snapshot;
    await expect(f.controller["dispatch"](policyIntent)).resolves.toBeUndefined();
    expect(Notice).toHaveBeenCalledExactlyOnceWith("Saved; constrained-tool cleanup is incomplete.");
    expect(f.store.snapshot).toBe(before);
  });
});

describe("permission grant intent composition", () => {
  it("keeps the exact rendered CAS/binding identity inside the current leaf/session envelope", async () => {
    const f = fixture();
    await f.controller["dispatch"](grantIntent);
    expect(f.dispatch).toHaveBeenCalledExactlyOnceWith({ ...grantIntent, schemaVersion: 1,
      intentId: expect.any(String), viewId: "view-a", mainSessionId: "session-a" });
    expect(f.dispatch.mock.calls[0]?.[0].payload).not.toHaveProperty("vaultId");
    expect(f.dispatch.mock.calls[0]?.[0].payload).not.toHaveProperty("projectId");
    expect(f.snapshot.session?.workspace).toEqual({ kind: "project", projectId: "project-a", label: "Synthetic Project" });
  });

  it.each(["other-session", "no-session"] as const)("rejects an old rendered grant when the active target becomes %s", async (change) => {
    const f = fixture();
    const session = f.snapshot.session;
    if (!session) throw new Error("Synthetic session missing");
    f.store.replace({ ...f.snapshot, session: change === "no-session" ? null : { ...session, id: "session-b" } });
    await expect(f.controller["dispatch"](grantIntent)).rejects.toThrow("active chat changed");
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it("rejects a stale grant control after negotiated capability was reset", async () => {
    const f = fixture();
    f.supportsCapability.mockReturnValue(false);
    await expect(f.controller["dispatch"](grantIntent)).rejects.toThrow("unavailable on this runtime connection");
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it.each(["rejected", "conflict"] as const)("preserves the host's %s outcome instead of claiming a saved grant", async (status) => {
    const f = fixture();
    f.dispatch.mockImplementation(async (intent) => ({ schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime-a", viewId: "view-a", intentId: intent.intentId,
      ...(status === "rejected" ? { status, errorCode: "stale-binding" } : { status, actualRevision: 8 }),
      notice: { level: "warning", message: "The current binding or policy changed." } }));
    await expect(f.controller["dispatch"](grantIntent)).rejects.toThrow("current binding or policy changed");
    expect(f.dispatch).toHaveBeenCalledOnce();
    expect(f.store.snapshot).toBe(f.snapshot);
  });

  it("keeps existing mode/network changes available without the optional grant capability", async () => {
    const f = fixture();
    f.supportsCapability.mockReturnValue(false);
    await f.controller["dispatch"]({ type: "permissions.set-access-policy", mainSessionId: "session-a", payload: {
      expectedRevision: 7, accessMode: "read-only", agentNetworkAccess: false,
    } });
    expect(f.dispatch).toHaveBeenCalledOnce();
  });

  it("reports capability unavailability returned by the host without claiming a save", async () => {
    const f = fixture();
    f.dispatch.mockImplementation(async (intent) => ({ schemaVersion: 1, protocolVersion: 2,
      runtimeInstanceId: "runtime-a", viewId: "view-a", intentId: intent.intentId, status: "unavailable",
      capability: "obsidian-vault-access", notice: { level: "warning", message: "Grant controls are unavailable." } }));
    await expect(f.controller["dispatch"](grantIntent)).rejects.toThrow("Grant controls are unavailable.");
    expect(f.dispatch).toHaveBeenCalledOnce();
    expect(f.store.snapshot).toBe(f.snapshot);
  });
});

describe("native setup controller identity and capability", () => {
  const input = { type: "permissions.setup-native-sandbox", payload: { expectedSessionId: "session-a",
    expectedBindingRevision: 4, expectedPolicyRevision: 7, expectedGrantRevision: 2, targetFingerprint: "a".repeat(64) } } as const;
  function nativeFixture() {
    const f = fixture();
    const screen: FrontendPermissionScreenViewModel = { screenId: "permissions", accessPolicySessionId: "session-a", revision: 1, loading: false,
      accessPolicy: { schemaVersion: 1, revision: 7, accessMode: "workspace", agentNetworkAccess: false },
      scope: { kind: "project", bindingRevision: 4, selectedRootCount: 1, filesystemBound: true },
      nativeSupport: { status: "unverified" },
      effective: { fileRead: false, fileWrite: false, localProcess: "unavailable", obsidian: "unavailable", agentNetworkAccess: false },
      nativeSetup: { sessionId: "session-a", current: { status: "available", bindingRevision: 4, policyRevision: 7,
        accessMode: "workspace", networkAccess: false, roots: [{ stableId: "a", path: "C:/Synthetic/current" }],
        grant: { revision: 2, targetFingerprint: "a".repeat(64), status: "setup-required" } },
        owned: { status: "available", revision: 2, grants: [] } } };
    f.store.replace({ ...f.snapshot, screenModels: [screen] });
    return { ...f, screen };
  }
  it("dispatches consent in only the current runtime/view/session envelope", async () => {
    const f = nativeFixture();
    await f.controller["dispatch"](input);
    expect(f.dispatch).toHaveBeenCalledExactlyOnceWith({ ...input, schemaVersion: 1, intentId: expect.any(String), viewId: "view-a", mainSessionId: "session-a" });
    expect(f.supportsCapability).toHaveBeenCalledWith("native-sandbox-setup");
    expect(f.dispatch.mock.calls[0]?.[0].payload).not.toHaveProperty("roots");
  });
  it.each(["capability", "session", "missing-screen", "loading", "policy"] as const)("rejects stale consent after %s", async (change) => {
    const f = nativeFixture();
    if (change === "capability") f.supportsCapability.mockReturnValue(false);
    else f.store.replace({ ...f.snapshot, session: change === "session" ? null : f.snapshot.session,
      screenModels: change === "missing-screen" ? [] : [{ ...f.screen, loading: change === "loading",
        accessPolicy: change === "policy" ? { ...f.screen.accessPolicy, revision: 8 } : f.screen.accessPolicy }] });
    await expect(f.controller["dispatch"](input)).rejects.toThrow(change === "capability" ? "unavailable" : "target changed");
    expect(f.dispatch).not.toHaveBeenCalled();
  });
  const verify = { type: "permissions.verify-native-sandbox", payload: { expectedSessionId: "session-a",
    expectedVerificationRevision: 3, installationFingerprint: "d".repeat(64), action: "verify" } } as const;
  it.each(["verify", "recover"] as const)("dispatches only the current installed %s consent envelope", async (action) => {
    const f = nativeFixture();
    f.store.replace({ ...f.snapshot, screenModels: [{ ...f.screen, nativeSetup: { ...f.screen.nativeSetup!,
      verification: { status: "available", revision: 3, installationFingerprint: "d".repeat(64), busy: false,
        ready: false, recoveryRequired: action === "recover" } } }] });
    const intent = { ...verify, payload: { ...verify.payload, action } };
    await f.controller["dispatch"](intent);
    expect(f.dispatch).toHaveBeenCalledExactlyOnceWith({ ...intent, schemaVersion: 1, intentId: expect.any(String),
      viewId: "view-a", mainSessionId: "session-a" });
    expect(f.supportsCapability).toHaveBeenCalledWith("native-sandbox-setup");
  });
  it.each(["capability", "session", "revision", "installation", "missing", "busy"] as const)(
    "rejects installed verification after %s changes", async (change) => {
      const f = nativeFixture();
      if (change === "capability") f.supportsCapability.mockReturnValue(false);
      f.store.replace({ ...f.snapshot, session: change === "session" ? null : f.snapshot.session,
        screenModels: [{ ...f.screen, nativeSetup: { ...f.screen.nativeSetup!, verification: change === "missing" ? undefined : {
          status: "available", revision: change === "revision" ? 4 : 3,
          installationFingerprint: (change === "installation" ? "e" : "d").repeat(64), busy: change === "busy",
          ready: false, recoveryRequired: false,
        } } }] });
      await expect(f.controller["dispatch"](verify)).rejects.toThrow(change === "capability" ? "unavailable" : "target changed");
      expect(f.dispatch).not.toHaveBeenCalled();
    });
});
