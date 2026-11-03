import { Notice } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFeedStore } from "../../src/features/feed/public";
import type { InteractionState, WsExtensionUIRequest } from "../../src/types";
import { ExtensionUiController } from "../../src/ui/controller/extension-ui-controller";
import type { FeedRenderer } from "../../src/ui/feed";
import { buildComposerShell } from "../../src/ui/shell/view-shell";

vi.mock("obsidian", { spy: true });
let requestId = "";
beforeEach(() => { requestId = crypto.randomUUID(); });
afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); });

function request(id = requestId): WsExtensionUIRequest {
  return { id, method: "confirm", params: { title: "Permission requested", permissionRequest: { requestId: id, toolName: "shell", reason: "Run the project tests after editing.", operationSummary: "npm test" } } };
}
function fixture() {
  const root = document.body.createDiv();
  const shell = buildComposerShell(root, "Message input");
  shell.inputEl.value = "My unfinished follow-up";
  let interaction: InteractionState | null = null;
  const setComposerText = vi.fn((text: string) => { shell.inputEl.value = text; });
  const mountInteraction = vi.fn();
  const controller = new ExtensionUiController({ getFeedStore: createFeedStore, getFeedRenderer: () => ({ mountInteraction, clearInteraction: vi.fn() }) as unknown as FeedRenderer,
    getPermissionRequestHost: () => shell.permissionRequestHostEl, getCancelKeybinding: () => "Escape", setComposerText, focusComposer: vi.fn(), getActiveInteraction: () => interaction, setActiveInteraction: (value) => { interaction = value; } });
  return { root, shell, controller, setComposerText, mountInteraction, get interaction() { return interaction; } };
}

describe("composer permission requests", () => {
  it("expands inside the composer above the draft and shows the exact action and reason", async () => {
    const f = fixture(); const pending = f.controller.handle(request());
    expect(f.shell.cardEl.firstElementChild).toBe(f.shell.permissionRequestHostEl);
    expect(f.shell.permissionRequestHostEl.textContent).toContain("npm test");
    expect(f.shell.permissionRequestHostEl.textContent).toContain("Run the project tests after editing.");
    expect(f.mountInteraction).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledTimes(1);
    expect(f.shell.inputEl.value).toBe("My unfinished follow-up");
    const buttons = f.shell.permissionRequestHostEl.querySelectorAll<HTMLButtonElement>("button");
    buttons[1]!.click();
    await expect(pending).resolves.toBe(true);
    expect(f.setComposerText).not.toHaveBeenCalled();
    expect(f.shell.permissionRequestHostEl.hasClass("is-hidden")).toBe(true);
  });

  it("never approves on composer Enter and denies using the configured cancel shortcut", async () => {
    const f = fixture(); const pending = f.controller.handle(request());
    f.controller.handleKeydown(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(f.interaction?.id).toBe(requestId);
    f.controller.handleKeydown(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(pending).resolves.toBe(false);
    expect(f.shell.inputEl.value).toBe("My unfinished follow-up");
  });

  it("queues exact requests, notifies once each, and cancels outstanding work on Stop/dispose", async () => {
    const f = fixture(); const first = f.controller.handle(request()); const second = f.controller.handle(request("request-two"));
    await expect(f.controller.handle(request())).resolves.toBeUndefined();
    expect(Notice).toHaveBeenCalledTimes(2);
    f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>("button")!.click();
    await expect(first).resolves.toBe(false);
    expect(f.interaction?.id).toBe("request-two");
    f.controller.dispose();
    await expect(second).resolves.toBeUndefined();
    expect(f.shell.permissionRequestHostEl.childElementCount).toBe(0);
    expect(f.setComposerText).not.toHaveBeenCalled();
  });

  it("rejects incomplete structured metadata without displaying a generic approval", async () => {
    const f = fixture(); await expect(f.controller.handle({ ...request(), params: { permissionRequest: { toolName: "shell" } } })).resolves.toBe(false);
    expect(f.interaction).toBeNull(); expect(Notice).not.toHaveBeenCalled();
  });

  it("dismisses only the exact UI request ID and preserves the draft and unrelated request", async () => {
    const f = fixture();
    const firstRequest = request("ui-waiter-one");
    firstRequest.params.permissionRequest = { requestId, toolName: "shell", reason: "Run tests.", operationSummary: "npm test" };
    const first = f.controller.handle(firstRequest);
    const second = f.controller.handle(request("ui-waiter-two"));
    await f.controller.handle({ id: requestId, method: "dismiss", params: {} });
    expect(f.interaction?.id).toBe("ui-waiter-one");
    await f.controller.handle({ id: "ui-waiter-one", method: "dismiss", params: {} });
    await expect(first).resolves.toBeUndefined();
    expect(f.interaction?.id).toBe("ui-waiter-two");
    expect(f.shell.inputEl.value).toBe("My unfinished follow-up");
    expect(f.setComposerText).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledTimes(2);
    f.shell.permissionRequestHostEl.querySelector<HTMLButtonElement>("button")!.click();
    await expect(second).resolves.toBe(false);
    expect(f.shell.permissionRequestHostEl.hasClass("is-hidden")).toBe(true);
  });

  it("removes a queued dismissed request without disturbing the active review", async () => {
    const f = fixture();
    const first = f.controller.handle(request());
    const queued = f.controller.handle(request("queued-review"));
    await f.controller.handle({ id: "queued-review", method: "dismiss", params: {} });
    await expect(queued).resolves.toBeUndefined();
    expect(f.interaction?.id).toBe(requestId);
    expect(f.shell.permissionRequestHostEl.textContent).toContain("npm test");
    f.controller.dispose();
    await expect(first).resolves.toBeUndefined();
  });

  it.each([{ allowed: true }, { reason: " " }, { operationSummary: "x".repeat(64_001) }])("rejects metadata outside the canonical review contract: %j", async (change) => {
    const f = fixture(); const value = request();
    await expect(f.controller.handle({ ...value, params: { ...value.params, permissionRequest: { ...(value.params.permissionRequest as Record<string, unknown>), ...change } } })).resolves.toBe(false);
    expect(f.interaction).toBeNull(); expect(Notice).not.toHaveBeenCalled();
  });
});
