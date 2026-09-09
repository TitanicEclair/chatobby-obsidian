import { Notice } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatobbyView } from "../../src/ui/view";
import type { FrontendIntentInput } from "../../src/frontend/frontend-protocol-controller";

vi.mock("obsidian", { spy: true });

beforeEach(() => vi.clearAllMocks());

function fixture(network = false) {
  const snapshot = { runtimeInstanceId: "runtime-1", viewId: "view-1", revision: 7, session: { id: "session-1" } };
  const store = { snapshot: { ...snapshot } };
  const dispatch = vi.fn(async (_intent: FrontendIntentInput) => ({ status: "applied" }));
  const loadScreen = vi.fn(async () => ({
    screenId: "permissions", accessPolicySessionId: "session-1", loading: false,
    accessPolicy: { schemaVersion: 1, revision: 12, accessMode: "workspace", agentNetworkAccess: network },
  }));
  const remember = vi.fn();
  const view = Object.assign(Object.create(ChatobbyView.prototype) as ChatobbyView, {
    frontendStore: store,
    frontendProtocol: { loadScreen, dispatch },
    plugin: { rememberSessionPreferences: remember },
  });
  return { view, store, dispatch, loadScreen, remember };
}

describe("Composer access-mode product dispatch", () => {
  it("changes only network through the current saved session's policy revision", async () => {
    const { view, dispatch, remember } = fixture(true);
    await view["applyFrontendControl"]("network", "off");
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: "permissions.set-access-policy", mainSessionId: "session-1", payload: { expectedRevision: 12, accessMode: "workspace", agentNetworkAccess: false } }));
    expect(remember).not.toHaveBeenCalled();
  });
  it("rejects Network Off in Full access without sending a policy mutation", async () => {
    const { view, loadScreen, dispatch } = fixture(true);
    loadScreen.mockResolvedValueOnce({ screenId: "permissions", accessPolicySessionId: "session-1", loading: false, accessPolicy: { schemaVersion: 1, revision: 12, accessMode: "full", agentNetworkAccess: true } });
    await expect(view["applyFrontendControl"]("network", "off")).rejects.toThrow("Full access includes network access");
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("ignores a deferred policy-load failure after switching sessions, while preserving current-load errors", async () => {
    const { view, store, dispatch, loadScreen } = fixture();
    let reject!: (error: Error) => void;
    loadScreen.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const pending = view["applyFrontendControl"]("permission", "read-only");
    const settled = expect(pending).resolves.toBeUndefined();
    expect(loadScreen).toHaveBeenCalledOnce();
    const replacement = { ...store.snapshot, session: { id: "session-2" } };
    store.snapshot = replacement;
    reject(new Error("Previous session load failed."));
    await settled;
    expect(store.snapshot).toBe(replacement);
    expect(dispatch).not.toHaveBeenCalled();
    expect(Notice).not.toHaveBeenCalled();
    loadScreen.mockRejectedValueOnce(new Error("Current session load failed."));
    await expect(view["applyFrontendControl"]("permission", "read-only")).rejects.toThrow("Current session load failed.");
  });
  it.each([
    ["read-only", false, false], ["workspace", false, false], ["full", false, true],
    ["read-only", true, true], ["workspace", true, true], ["full", true, true],
  ] as const)("dispatches %s from current session policy with network %s", async (mode, before, after) => {
    const { view, dispatch, loadScreen, remember } = fixture(before);
    await view["applyFrontendControl"]("permission", mode);
    expect(loadScreen).toHaveBeenCalledWith({ screenId: "permissions" });
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      type: "permissions.set-access-policy", mainSessionId: "session-1",
      payload: { expectedRevision: 12, accessMode: mode, agentNetworkAccess: after },
    }));
    expect(remember).not.toHaveBeenCalled();
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain("permissionProfileId");
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain("obsidianVaultAccess");
    expect(Notice).not.toHaveBeenCalled();
  });

  it.each(["auto", "full-access", "obsidian", ""])("rejects retired or invalid mode %s", async (mode) => {
    const { view, dispatch, loadScreen } = fixture();
    await expect(view["applyFrontendControl"]("permission", mode)).rejects.toThrow("Invalid access mode");
    expect(loadScreen).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each(["runtimeInstanceId", "viewId"] as const)("ignores changed %s during policy refresh", async (key) => {
    const { view, store, dispatch, loadScreen } = fixture();
    loadScreen.mockImplementationOnce(async () => {
      store.snapshot = { ...store.snapshot, [key]: "replaced" };
      return { screenId: "permissions", accessPolicySessionId: "session-1", loading: false,
        accessPolicy: { schemaVersion: 1, revision: 12, accessMode: "workspace", agentNetworkAccess: false } };
    });
    await expect(view["applyFrontendControl"]("permission", "full")).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("ignores a changed active session during policy refresh", async () => {
    const { view, store, dispatch, loadScreen } = fixture();
    loadScreen.mockImplementationOnce(async () => {
      store.snapshot = { ...store.snapshot, session: { id: "session-2" } };
      return { screenId: "permissions", accessPolicySessionId: "session-1", loading: false,
        accessPolicy: { schemaVersion: 1, revision: 12, accessMode: "workspace", agentNetworkAccess: false } };
    });
    await expect(view["applyFrontendControl"]("permission", "full")).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("waits for acknowledgment and reports rejection without persisting a preference", async () => {
    const { view, dispatch, remember } = fixture();
    let settle!: (result: { status: string; notice: { message: string } }) => void;
    dispatch.mockImplementationOnce(() => new Promise((resolve) => { settle = resolve; }));
    const failure = expect(view["applyFrontendControl"]("permission", "full")).rejects.toThrow("Policy changed. Refresh and retry.");
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(remember).not.toHaveBeenCalled();
    settle({ status: "conflict", notice: { message: "Policy changed. Refresh and retry." } });
    await failure;
    expect(remember).not.toHaveBeenCalled();
    expect(Notice).not.toHaveBeenCalled();
  });

  it.each(["applied", "accepted"])("shows a saved-policy warning after %s without rejecting the saved selection", async (status) => {
    const { view, dispatch, remember } = fixture();
    const message = "Access policy saved, but constrained-tool cleanup could not be confirmed. Review Permissions before retrying tools.";
    dispatch.mockResolvedValueOnce({ status, notice: { level: "warning", message } });

    await expect(view["applyFrontendControl"]("permission", "read-only")).resolves.toBeUndefined();

    expect(Notice).toHaveBeenCalledExactlyOnceWith(message);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(remember).not.toHaveBeenCalled();
  });

  it("rejects another session's screen even when its policy revision matches", async () => {
    const { view, loadScreen, dispatch } = fixture();
    loadScreen.mockResolvedValueOnce({ screenId: "permissions", accessPolicySessionId: "session-2", loading: false,
      accessPolicy: { schemaVersion: 1, revision: 12, accessMode: "workspace", agentNetworkAccess: false } });
    await expect(view["applyFrontendControl"]("permission", "read-only")).rejects.toThrow("current session access policy");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each(["applied", "conflict", "transport-error"])("ignores a late %s for the previous session without changing its replacement", async (status) => {
    const { view, store, dispatch, remember } = fixture();
    let resolve!: (result: { status: string; notice: { message: string } }) => void;
    let reject!: (error: Error) => void;
    dispatch.mockImplementationOnce(() => new Promise((done, fail) => { resolve = done; reject = fail; }));
    const pending = view["applyFrontendControl"]("permission", "read-only");
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledOnce());
    const replacement = { ...store.snapshot, session: { id: "session-2" } };
    store.snapshot = replacement;
    if (status === "transport-error") reject(new Error("Previous session transport failed."));
    else resolve({ status, notice: { message: "Previous session policy notice." } });
    await expect(pending).resolves.toBeUndefined();
    expect(store.snapshot).toBe(replacement);
    expect(Notice).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
