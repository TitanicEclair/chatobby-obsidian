import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeStatusController } from "../../src/features/runtime-status/public";
import type { RuntimeLifecycleState } from "../../src/runtime/public";

afterEach(() => {
  vi.useRealTimers();
  document.body.empty();
});

describe("RuntimeStatusController", () => {
  it("does not flash a banner when startup becomes ready within the reveal threshold", async () => {
    vi.useFakeTimers();
    let state: RuntimeLifecycleState = { status: "resolving", mode: "managed" };
    const controller = controllerFor(() => state);
    const container = document.body.createDiv();
    controller.bind(container);

    state = readyState();
    controller.render();
    await vi.advanceTimersByTimeAsync(300);

    expect(container.hasClass("is-hidden")).toBe(true);
    expect(container.textContent).toBe("");
  });

  it("shows semantic delayed startup state with a polite live region", async () => {
    vi.useFakeTimers();
    const controller = controllerFor(() => ({ status: "spawning", mode: "managed", attempt: 2 }));
    const container = document.body.createDiv();
    controller.bind(container);
    expect(container.textContent).toBe("");

    await vi.advanceTimersByTimeAsync(250);

    expect(container.textContent).toContain("Starting Chatobby");
    expect(container.textContent).toContain("attempt 2");
    expect(container.getAttribute("aria-live")).toBe("polite");
  });

  it("renders terminal diagnostics once and exposes a recovery action", () => {
    const restart = vi.fn(async () => {});
    const state: RuntimeLifecycleState = {
      status: "crash_loop",
      mode: "managed",
      diagnostics: {
        code: "spawn_failed",
        message: "Runtime exited repeatedly",
        recentLogs: ["bounded line"],
        occurredAt: 1,
      },
    };
    const controller = new RuntimeStatusController({
      getState: () => state,
      start: vi.fn(),
      restart,
      install: vi.fn(),
    });
    const container = document.body.createDiv();
    controller.bind(container);
    const firstTitle = container.querySelector(".chatobby-runtime-status__title");

    controller.render();

    expect(container.querySelector(".chatobby-runtime-status__title")).toBe(firstTitle);
    expect(container.textContent).toContain("Automatic restart paused");
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
    const tryAgain = Array.from(container.querySelectorAll("button"))
      .find((candidate) => candidate.textContent === "Try again") as HTMLButtonElement;
    tryAgain.click();
    expect(restart).toHaveBeenCalledOnce();
  });

  it("opens the in-plugin installer when the managed runtime is missing", () => {
    const install = vi.fn(async () => {});
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
    const controller = new RuntimeStatusController({
      getState: () => state,
      start: vi.fn(),
      restart: vi.fn(),
      install,
    });
    const container = document.body.createDiv();
    controller.bind(container);

    const button = Array.from(container.querySelectorAll("button"))
      .find((candidate) => candidate.textContent === "Install runtime") as HTMLButtonElement;
    button.click();

    expect(install).toHaveBeenCalledOnce();
  });

  it("does not present installation as the fix for a transient startup failure", () => {
    const state: RuntimeLifecycleState = {
      status: "error",
      mode: "managed",
      diagnostics: {
        code: "spawn_failed",
        message: "The installed runtime could not start",
        recentLogs: [],
        occurredAt: 1,
      },
    };
    const controller = new RuntimeStatusController({
      getState: () => state,
      start: vi.fn(),
      restart: vi.fn(),
      install: vi.fn(),
    });
    const container = document.body.createDiv();
    controller.bind(container);

    expect(Array.from(container.querySelectorAll("button")).map((button) => button.textContent))
      .toEqual(["Retry"]);
  });

  it("offers verified repair instead of retrying an invalid managed package", () => {
    const install = vi.fn(async () => {});
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
    const controller = new RuntimeStatusController({
      getState: () => state,
      start: vi.fn(),
      restart: vi.fn(),
      install,
    });
    const container = document.body.createDiv();
    controller.bind(container);

    expect(container.textContent).toContain("Chatobby needs repair");
    expect(Array.from(container.querySelectorAll("button")).map((button) => button.textContent))
      .toEqual(["Repair Chatobby"]);
    (container.querySelector("button") as HTMLButtonElement).click();
    expect(install).toHaveBeenCalledWith(true);
  });
});

function controllerFor(getState: () => RuntimeLifecycleState): RuntimeStatusController {
  return new RuntimeStatusController({
    getState,
    start: vi.fn(),
    restart: vi.fn(),
    install: vi.fn(),
  });
}

function readyState(): RuntimeLifecycleState {
  return {
    status: "ready",
    readyAt: 1,
    runtime: {
      endpoint: "ws://127.0.0.1:43125",
      ownership: "managed",
      identity: {
        instanceId: "runtime-1",
        vaultId: "vault-1",
        pid: 1,
        startedAt: 1,
        runtimeVersion: "0.1.0",
        protocolVersion: 1,
      },
    },
  };
}
