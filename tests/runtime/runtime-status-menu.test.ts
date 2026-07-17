import { Menu } from "obsidian";
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
      getState: () => state,
      hasActiveWork: () => false,
      restart: vi.fn(),
      stop: vi.fn(),
      supportsRuntimeUpdates: () => true,
      manageRuntime,
    });
    const button = document.body.createEl("button");
    menu.bind(button);
    button.dispatchEvent(new MouseEvent("click"));

    const install = testMenu.lastShown?.items.find((item) => item.title === "Install Chatobby runtime");
    expect(install?.icon).toBe("download");
    install?.callback?.();
    expect(manageRuntime).toHaveBeenCalledOnce();
  });
});
