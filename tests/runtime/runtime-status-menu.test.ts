import { type App, Menu } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeStatusMenu } from "../../src/features/runtime-status/public";
import type { RuntimeLifecycleState } from "../../src/runtime/public";

const testMenu = Menu as unknown as {
  lastShown: {
    items: Array<{ title: string; icon: string; callback: (() => void) | null }>;
  } | null;
};

afterEach(() => {
  testMenu.lastShown = null;
  document.body.empty();
});

describe("RuntimeStatusMenu", () => {
  it("offers in-plugin installation when the runtime is missing", () => {
    const manageRuntime = vi.fn();
    const state: RuntimeLifecycleState = {
      status: "error",
      mode: "managed",
      diagnostics: {
        code: "runtime_not_installed",
        message: "The Chatobby runtime is not installed",
        recentLogs: [],
        occurredAt: 1,
      },
    };
    const menu = new RuntimeStatusMenu({
      app: {} as App,
      getState: () => state,
      hasActiveWork: () => false,
      restart: vi.fn(),
      stop: vi.fn(),
      supportsRuntimeUpdates: () => true,
      automaticProvisioning: () => false,
      retryProvisioning: vi.fn(),
      manageRuntime,
      removeRuntime: vi.fn(),
    });
    const button = document.body.createEl("button");
    menu.bind(button);
    button.dispatchEvent(new MouseEvent("click"));

    const install = testMenu.lastShown?.items.find((item) => item.title === "Install Chatobby runtime");
    expect(install?.icon).toBe("download");
    install?.callback?.();
    expect(manageRuntime).toHaveBeenCalledOnce();
  });

  it("routes an invalid signed package to same-version repair", () => {
    const manageRuntime = vi.fn();
    const state: RuntimeLifecycleState = {
      status: "error",
      mode: "managed",
      diagnostics: {
        code: "runtime_package_invalid",
        message: "Runtime package signature is invalid",
        recentLogs: [],
        occurredAt: 1,
      },
    };
    const menu = new RuntimeStatusMenu({
      app: {} as App,
      getState: () => state,
      hasActiveWork: () => false,
      restart: vi.fn(),
      stop: vi.fn(),
      supportsRuntimeUpdates: () => true,
      automaticProvisioning: () => false,
      retryProvisioning: vi.fn(),
      manageRuntime,
      removeRuntime: vi.fn(),
    });
    const button = document.body.createEl("button");
    menu.bind(button);
    button.dispatchEvent(new MouseEvent("click"));

    const repair = testMenu.lastShown?.items.find((item) => item.title === "Repair Chatobby");
    expect(repair?.icon).toBe("shield-alert");
    repair?.callback?.();
    expect(manageRuntime).toHaveBeenCalledWith(true);
  });

  it("retries automatic setup without offering manual installation", () => {
    const retryProvisioning = vi.fn(async () => {});
    const manageRuntime = vi.fn();
    const state: RuntimeLifecycleState = {
      status: "error",
      mode: "managed",
      diagnostics: {
        code: "runtime_not_installed",
        message: "The Chatobby runtime is not installed",
        recentLogs: [],
        occurredAt: 1,
      },
    };
    const menu = new RuntimeStatusMenu({
      app: {} as App,
      getState: () => state,
      hasActiveWork: () => false,
      restart: vi.fn(),
      stop: vi.fn(),
      supportsRuntimeUpdates: () => true,
      automaticProvisioning: () => true,
      retryProvisioning,
      manageRuntime,
      removeRuntime: vi.fn(),
    });
    const button = document.body.createEl("button");
    menu.bind(button);
    button.dispatchEvent(new MouseEvent("click"));

    expect(testMenu.lastShown?.items.some((item) => item.title === "Install Chatobby runtime")).toBe(false);
    const retry = testMenu.lastShown?.items.find((item) => item.title === "Retry Chatobby setup");
    retry?.callback?.();
    expect(retryProvisioning).toHaveBeenCalledOnce();
    expect(manageRuntime).not.toHaveBeenCalled();
  });

  it("offers diagnostics but no runtime action while exact-pair startup is blocked", () => {
    const state: RuntimeLifecycleState = {
      status: "error",
      mode: "managed",
      diagnostics: {
        code: "development_pair_adoption_failed",
        message: "Restage a valid exact pair, then reload Chatobby.",
        recentLogs: [],
        occurredAt: 1,
      },
    };
    const menu = new RuntimeStatusMenu({
      app: {} as App,
      getState: () => state,
      hasActiveWork: () => false,
      restart: vi.fn(),
      stop: vi.fn(),
      supportsRuntimeUpdates: () => true,
      automaticProvisioning: () => false,
      retryProvisioning: vi.fn(),
      manageRuntime: vi.fn(),
      removeRuntime: vi.fn(),
    });
    const button = document.body.createEl("button");
    menu.bind(button);
    button.dispatchEvent(new MouseEvent("click"));

    expect(testMenu.lastShown?.items.map((item) => item.title)).toEqual(["Copy diagnostics"]);
  });
});
