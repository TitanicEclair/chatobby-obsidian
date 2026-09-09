import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeUpdateController } from "../../src/features/runtime-status/public";
import type { RuntimeUpdateState } from "../../src/runtime/public";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

afterEach(() => document.body.empty());

describe("RuntimeUpdateController", () => {
  it("stays absent until an update is available and renders one compact action", () => {
    let state: RuntimeUpdateState = { status: "idle" };
    let listener: ((next: RuntimeUpdateState) => void) | null = null;
    const openInstaller = vi.fn();
    const controller = new RuntimeUpdateController({
      getState: () => state,
      onStateChange: (next) => { listener = next; return () => { listener = null; }; },
      openInstaller,
      automaticProvisioning: () => false,
      retryProvisioning: vi.fn(),
    });
    const container = document.body.createDiv();
    controller.bind(container);
    expect(container.hasClass("is-hidden")).toBe(true);

    state = { status: "available", descriptor: descriptor(), installedVersion: "0.1.2", kind: "update" };
    listener?.(state);

    expect(container.hasClass("is-hidden")).toBe(false);
    expect(container.textContent).toContain("Runtime 0.1.3 available");
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.textContent).toBe("Update Chatobby");
    button.click();
    expect(openInstaller).toHaveBeenCalledOnce();
  });

  it("reports automatic progress without presenting a second update confirmation", () => {
    let state: RuntimeUpdateState = {
      status: "available",
      descriptor: descriptor(),
      installedVersion: "0.1.2",
      kind: "update",
    };
    let listener: ((next: RuntimeUpdateState) => void) | null = null;
    const retryProvisioning = vi.fn(async () => {});
    const openInstaller = vi.fn();
    const controller = new RuntimeUpdateController({
      getState: () => state,
      onStateChange: (next) => { listener = next; return () => { listener = null; }; },
      openInstaller,
      automaticProvisioning: () => true,
      retryProvisioning,
    });
    const container = document.body.createDiv();
    controller.bind(container);

    expect(container.textContent).toContain("Preparing runtime 0.1.3");
    expect(container.querySelector("button")).toBeNull();

    state = { status: "deferred", descriptor: descriptor(), installedVersion: "0.1.2", kind: "update", reason: "active-work" };
    listener?.(state);
    expect(container.textContent).toContain("continue when current work finishes");
    expect(container.querySelector("button")).toBeNull();

    state = { status: "error", descriptor: descriptor(), kind: "update", message: "offline" };
    listener?.(state);
    const retry = container.querySelector("button") as HTMLButtonElement;
    expect(retry.textContent).toBe("Retry");
    retry.click();
    expect(retryProvisioning).toHaveBeenCalledOnce();
    expect(openInstaller).not.toHaveBeenCalled();
  });
});

function descriptor() {
  return {
    schemaVersion: 1 as const,
    product: "Chatobby Runtime" as const,
    version: "0.1.3",
    protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
    minimumPluginVersion: "0.1.0",
    maximumPluginVersion: "0.1.x",
    platform: process.platform,
    arch: process.arch,
    bundle: {
      format: "chatobby-runtime-bundle-v1" as const,
      file: `chatobby-runtime-0.1.3-${process.platform}-${process.arch}.cbr.gz`,
      size: 10,
      sha256: "a".repeat(64),
      uncompressedSize: 20,
      entryCount: 1,
    },
    signatureAlgorithm: "ed25519" as const,
    signature: "fixture",
  };
}
