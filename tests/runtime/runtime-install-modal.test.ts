import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeInstallModal } from "../../src/features/runtime-status/public";
import type { RuntimeUpdateState } from "../../src/runtime/public";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

afterEach(() => document.body.empty());

describe("RuntimeInstallModal", () => {
  it("explains a fresh install and requires an explicit confirmation", async () => {
    const state: RuntimeUpdateState = { status: "available", descriptor: descriptor(), installedVersion: null, kind: "install" };
    const install = vi.fn(async () => "0.1.2");
    const modal = new RuntimeInstallModal({} as App, {
      getState: () => state,
      onStateChange: () => () => undefined,
      checkForUpdate: vi.fn(),
      checkForRepair: vi.fn(),
      install,
      hasActiveWork: () => false,
    });

    modal.open();

    expect(modal.titleEl.textContent).toBe("Install Chatobby");
    expect(modal.contentEl.textContent).toContain("needs its local runtime");
    expect(modal.contentEl.textContent).toContain("Security and installation details");
    expect(install).not.toHaveBeenCalled();
    const button = Array.from(modal.contentEl.querySelectorAll("button"))
      .find((candidate) => candidate.textContent === "Install") as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
  });

  it("allows an explicit update to stop active work and explains the effect", () => {
    const state: RuntimeUpdateState = {
      status: "available",
      descriptor: descriptor(),
      installedVersion: "0.1.1",
      kind: "update",
    };
    const modal = new RuntimeInstallModal({} as App, {
      getState: () => state,
      onStateChange: () => () => undefined,
      checkForUpdate: vi.fn(),
      checkForRepair: vi.fn(),
      install: vi.fn(),
      hasActiveWork: () => true,
    });

    modal.open();

    expect(modal.contentEl.textContent).toContain("Updating stops current work");
    const update = Array.from(modal.contentEl.querySelectorAll("button"))
      .find((candidate) => candidate.textContent === "Update") as HTMLButtonElement;
    expect(update.disabled).toBe(false);
  });

  it("keeps backend deferral visible when installation returns the existing version", async () => {
    let state: RuntimeUpdateState = {
      status: "available", descriptor: descriptor(), installedVersion: "0.1.1", kind: "update",
    };
    const modal = new RuntimeInstallModal({} as App, {
      getState: () => state,
      onStateChange: () => () => undefined,
      checkForUpdate: vi.fn(),
      checkForRepair: vi.fn(),
      install: async () => {
        state = { status: "deferred", descriptor: descriptor(), installedVersion: "0.1.1", kind: "update", reason: "active-work" };
        return "0.1.1";
      },
      hasActiveWork: () => false,
    });
    modal.open();
    Array.from(modal.contentEl.querySelectorAll("button")).find((button) => button.textContent === "Update")!.click();
    await vi.waitFor(() => expect(modal.titleEl.textContent).toBe("Chatobby update is waiting"));
    expect(modal.contentEl.textContent).not.toContain("installed and connected");
    expect(modal.contentEl.textContent).toContain("Try again");
  });

  it("shows installation success only after the backend confirms the installed version", async () => {
    let state: RuntimeUpdateState = {
      status: "available", descriptor: descriptor(), installedVersion: "0.1.1", kind: "update",
    };
    const modal = new RuntimeInstallModal({} as App, {
      getState: () => state,
      onStateChange: () => () => undefined,
      checkForUpdate: vi.fn(),
      checkForRepair: vi.fn(),
      install: async () => {
        state = { status: "current", installedVersion: "0.1.2", checkedAt: 1 };
        return "0.1.2";
      },
      hasActiveWork: () => false,
    });
    modal.open();
    Array.from(modal.contentEl.querySelectorAll("button")).find((button) => button.textContent === "Update")!.click();
    await vi.waitFor(() => expect(modal.titleEl.textContent).toBe("Chatobby is ready"));
    expect(modal.contentEl.textContent).toContain("Runtime 0.1.2 is installed and connected.");
  });

  it("presents same-version repair as a distinct explicit action", async () => {
    const state: RuntimeUpdateState = {
      status: "available",
      descriptor: descriptor(),
      installedVersion: "0.1.2",
      kind: "repair",
    };
    const checkForRepair = vi.fn();
    const install = vi.fn(async () => "0.1.2");
    const modal = new RuntimeInstallModal({} as App, {
      getState: () => state,
      onStateChange: () => () => undefined,
      checkForUpdate: vi.fn(),
      checkForRepair,
      install,
      hasActiveWork: () => false,
    }, true);

    modal.open();

    expect(modal.titleEl.textContent).toBe("Repair Chatobby");
    expect(modal.contentEl.textContent).toContain("fresh, signed copy");
    expect(checkForRepair).toHaveBeenCalledOnce();
    const repair = Array.from(modal.contentEl.querySelectorAll("button"))
      .find((candidate) => candidate.textContent === "Repair") as HTMLButtonElement;
    repair.click();
    await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
  });
});

function descriptor() {
  return {
    schemaVersion: 1 as const,
    product: "Chatobby Runtime" as const,
    version: "0.1.2",
    protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
    minimumPluginVersion: "0.1.0",
    maximumPluginVersion: "0.1.x",
    platform: process.platform,
    arch: process.arch,
    bundle: {
      format: "chatobby-runtime-bundle-v1" as const,
      file: `chatobby-runtime-0.1.2-${process.platform}-${process.arch}.cbr.gz`,
      size: 10 * 1024 * 1024,
      sha256: "a".repeat(64),
      uncompressedSize: 20 * 1024 * 1024,
      entryCount: 10,
    },
    signatureAlgorithm: "ed25519" as const,
    signature: "fixture",
  };
}
