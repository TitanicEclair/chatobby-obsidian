import { describe, expect, it, vi } from "vitest";
import {
  ConnectedViewRestorationController,
  restoreConnectedView,
} from "../../src/ui/controller/connected-view-restoration";

describe("restoreConnectedView", () => {
  it("restores the session before bootstrapping and loading the active screen", async () => {
    const order: string[] = [];
    await restoreConnectedView({
      isCurrent: () => true,
      restoreSession: async () => { order.push("session"); },
      synchronizeFrontend: async () => { order.push("frontend"); },
      synchronizeActiveScreen: () => { order.push("screen"); },
      markRestored: () => { order.push("restored"); },
      reportSessionError: vi.fn(),
      reportFrontendError: vi.fn(),
    });

    expect(order).toEqual(["session", "frontend", "screen", "restored"]);
  });

  it("still loads the active screen when session restoration reports a recoverable error", async () => {
    const reportSessionError = vi.fn();
    const synchronizeActiveScreen = vi.fn();
    const markRestored = vi.fn();
    await restoreConnectedView({
      isCurrent: () => true,
      restoreSession: async () => { throw new Error("session unavailable"); },
      synchronizeFrontend: async () => undefined,
      synchronizeActiveScreen,
      markRestored,
      reportSessionError,
      reportFrontendError: vi.fn(),
    });

    expect(reportSessionError).toHaveBeenCalledOnce();
    expect(synchronizeActiveScreen).toHaveBeenCalledOnce();
    expect(markRestored).not.toHaveBeenCalled();
  });

  it("stops when the transport changes before frontend bootstrap", async () => {
    let current = true;
    const synchronizeFrontend = vi.fn();
    await restoreConnectedView({
      isCurrent: () => current,
      restoreSession: async () => { current = false; },
      synchronizeFrontend,
      synchronizeActiveScreen: vi.fn(),
      markRestored: vi.fn(),
      reportSessionError: vi.fn(),
      reportFrontendError: vi.fn(),
    });

    expect(synchronizeFrontend).not.toHaveBeenCalled();
  });

  it("does not load a screen from a failed frontend bootstrap", async () => {
    const reportFrontendError = vi.fn();
    const synchronizeActiveScreen = vi.fn();
    await restoreConnectedView({
      isCurrent: () => true,
      restoreSession: async () => undefined,
      synchronizeFrontend: async () => { throw new Error("bootstrap failed"); },
      synchronizeActiveScreen,
      markRestored: vi.fn(),
      reportSessionError: vi.fn(),
      reportFrontendError,
    });

    expect(reportFrontendError).toHaveBeenCalledOnce();
    expect(synchronizeActiveScreen).not.toHaveBeenCalled();
  });

  it("de-duplicates one connection restoration and permits a later reconnect", async () => {
    let release: (() => void) | undefined;
    const synchronizeFrontend = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const controller = new ConnectedViewRestorationController<object>({
      isCurrent: () => true,
      restoreSession: async () => undefined,
      synchronizeFrontend,
      synchronizeActiveScreen: vi.fn(),
      markRestored: vi.fn(),
      reportSessionError: vi.fn(),
      reportFrontendError: vi.fn(),
    });
    const transport = {};

    controller.synchronize(transport);
    controller.synchronize(transport);
    await vi.waitFor(() => expect(synchronizeFrontend).toHaveBeenCalledOnce());
    release?.();
    await vi.waitFor(() => expect(release).toBeDefined());
    await Promise.resolve();
    controller.synchronize(transport);
    await vi.waitFor(() => expect(synchronizeFrontend).toHaveBeenCalledTimes(2));
  });
});
