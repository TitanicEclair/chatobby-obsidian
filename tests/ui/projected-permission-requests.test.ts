import { Notice, type App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFeedStore } from "../../src/features/feed/public";
import { FrontendStore } from "../../src/frontend/frontend-store";
import type { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import type { FrontendBootstrap } from "../../src/vendor/chatobby-client/frontend-contracts";
import type { InteractionState } from "../../src/types";
import { ExtensionUiController } from "../../src/ui/controller/extension-ui-controller";
import { dispatchNoticeAction } from "../../src/ui/controller/notice-intent-controller";
import { synchronizeFeedPermissionRequests } from "../../src/features/permissions/application/feed-permission-requests";
import { ProjectedPermissionRequests } from "../../src/features/permissions/application/projected-permission-requests";
import { buildComposerShell } from "../../src/ui/shell/view-shell";

vi.mock("obsidian", { spy: true });
afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); });

function fixture() {
  const requestId = crypto.randomUUID();
  const allow = `subagent-permission:approve:run-one:node-one:${requestId}:4`;
  const deny = `subagent-permission:deny:run-one:node-one:${requestId}:4`;
  const review = { requestId, toolName: "bash", reason: "Verify the change", operationSummary: "npm run check" };
  const snapshot = { runtimeInstanceId: crypto.randomUUID(), viewId: "view-one", revision: 1, session: { id: "session-one" },
    feed: { revision: 1, blocks: [{ type: "notice", id: `subagent-permission:${requestId}`, title: "Permission requested", body: "Durable review", level: "warning", createdAt: 1,
      permissionRequest: review, actions: [{ id: allow, label: "Allow once" }, { id: deny, label: "Deny" }] }] } } as unknown as FrontendBootstrap;
  const store = new FrontendStore(); store.replace(snapshot);
  const dispatch = vi.fn(async () => ({ status: "applied" }));
  const protocol = { dispatch } as unknown as FrontendProtocolController;
  const shell = buildComposerShell(document.body.createDiv(), "Message"); shell.inputEl.value = "Unfinished draft";
  let interaction: InteractionState | null = null;
  const ui = new ExtensionUiController({ getFeedStore: createFeedStore, getFeedRenderer: () => null, getPermissionRequestHost: () => shell.permissionRequestHostEl,
    setComposerText: vi.fn(), focusComposer: vi.fn(), getActiveInteraction: () => interaction, setActiveInteraction: (value) => { interaction = value; } });
  const errors = vi.fn();
  const presenter = new ProjectedPermissionRequests(ui, errors);
  const sync = () => synchronizeFeedPermissionRequests(presenter, store.snapshot!, () => store.snapshot, (actionId) => dispatchNoticeAction(actionId, {} as App, store, protocol));
  return { store, snapshot, dispatch, protocol, shell, ui, presenter, errors, sync, allow, deny };
}

describe("durable permission composer projection", () => {
  it("retains the feed notice and draft, displays once, and sends the bound request revision", async () => {
    const f = fixture(); f.sync(); f.sync();
    expect(Notice).toHaveBeenCalledTimes(1);
    expect(f.shell.permissionRequestHostEl.textContent).toContain("Verify the change");
    expect(f.store.snapshot?.feed.blocks).toHaveLength(1);
    f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>(".mod-cta")!.click();
    await vi.waitFor(() => expect(f.dispatch).toHaveBeenCalledOnce());
    expect(f.dispatch).toHaveBeenCalledWith(expect.objectContaining({ mainSessionId: "session-one", type: "subagent.decide-permission", payload: expect.objectContaining({ runId: "run-one", nodeId: "node-one", expectedPermissionRequestRevision: 4, approved: true }) }));
    expect(f.shell.inputEl.value).toBe("Unfinished draft"); f.presenter.clear();
  });

  it("coalesces simultaneous feed and composer decisions for one request", async () => {
    const f = fixture(); f.sync();
    f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>(".mod-cta")!.click();
    await dispatchNoticeAction(f.allow, {} as App, f.store, f.protocol);
    await vi.waitFor(() => expect(f.dispatch).toHaveBeenCalledOnce());
    await dispatchNoticeAction(f.deny, {} as App, f.store, f.protocol);
    expect(f.dispatch).toHaveBeenCalledOnce(); f.presenter.clear();
  });

  it("dismisses resolved requests and detached controls without sending a decision", async () => {
    const f = fixture(); f.sync(); const detached = f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>(".mod-cta")!;
    f.store.replace({ ...f.snapshot, feed: { revision: 2, blocks: [] } }); f.sync(); detached.click();
    await Promise.resolve(); expect(f.dispatch).not.toHaveBeenCalled(); expect(f.ui.isActive()).toBe(false);
  });

  it("does not retarget a decision after the session or runtime changes", async () => {
    const f = fixture(); f.sync();
    const detached = f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>(".mod-cta")!;
    f.store.replace({ ...f.snapshot, runtimeInstanceId: "other-runtime", session: { ...f.snapshot.session!, id: "other-session" } }); f.sync();
    detached.click(); await Promise.resolve(); expect(f.dispatch).not.toHaveBeenCalled(); f.presenter.clear();
  });

  it("redisplays a still-pending request after navigation without another notification", () => {
    const f = fixture(); f.sync(); f.presenter.update("other-binding", []); f.sync();
    expect(f.ui.isActive()).toBe(true); expect(Notice).toHaveBeenCalledOnce(); f.presenter.clear();
  });

  it.each(["disconnected", "conflict"])("redisplays a %s decision without another request notification and permits one successful retry", async (failure) => {
    const f = fixture();
    if (failure === "disconnected") f.dispatch.mockRejectedValueOnce(new Error("Connection closed"));
    else f.dispatch.mockResolvedValueOnce({ status: "conflict" });
    f.sync();
    f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>(".mod-cta")!.click();
    await vi.waitFor(() => expect(f.errors).toHaveBeenCalledOnce());
    expect(f.ui.isActive()).toBe(true); expect(Notice).toHaveBeenCalledOnce();
    expect(f.shell.inputEl.value).toBe("Unfinished draft");
    f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>(".mod-cta")!.click();
    await vi.waitFor(() => expect(f.dispatch).toHaveBeenCalledTimes(2));
    await dispatchNoticeAction(f.allow, {} as App, f.store, f.protocol);
    expect(f.dispatch).toHaveBeenCalledTimes(2); f.presenter.clear();
  });

  it("does not remount a failed decision after its authoritative request disappears", async () => {
    const f = fixture();
    let reject: (error: Error) => void = () => {};
    f.dispatch.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    f.sync(); f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>(".mod-cta")!.click();
    await vi.waitFor(() => expect(f.dispatch).toHaveBeenCalledOnce());
    f.store.replace({ ...f.snapshot, feed: { revision: 2, blocks: [] } }); f.sync();
    reject(new Error("Already resolved"));
    await vi.waitFor(() => expect(f.errors).toHaveBeenCalledOnce());
    expect(f.ui.isActive()).toBe(false); expect(Notice).toHaveBeenCalledOnce();
    f.store.replace(f.snapshot); f.sync();
    expect(f.ui.isActive()).toBe(true); expect(Notice).toHaveBeenCalledOnce(); f.presenter.clear();
  });
});
