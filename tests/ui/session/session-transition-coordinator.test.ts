import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationCoordinator } from "../../../src/features/operations/public";
import { SessionTransitionCoordinator } from "../../../src/ui/session/session-transition-coordinator";
import type { SessionController, SessionMutationRequest } from "../../../src/ui/controller/session-controller";
import { createSessionControllerHarness, flushMicrotasks, sessionViewModel } from "../../support/session/controller";

/** @see docs/architecture/managed-runtime-lifecycle.md#leaf-session-recovery */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SessionTransitionCoordinator", () => {
  it("holds the loading surface until pending snapshots flush and two frames paint", async () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const operations = new OperationCoordinator();
    const host = document.createElement("div");
    host.className = "is-hidden";
    const flush = vi.fn();
    const coordinator = new SessionTransitionCoordinator(host, operations, flush);
    coordinator.open();

    let completeMutation = (): void => {};
    const transition = operations.run(
      { key: "session-transition", id: "session:resume", label: "Resuming session" },
      async () => {
        await new Promise<void>((resolve) => { completeMutation = resolve; });
        await coordinator.settle();
      },
    );

    expect(host.classList.contains("is-hidden")).toBe(false);
    completeMutation();
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(host.classList.contains("is-hidden")).toBe(false);

    frames.shift()?.(0);
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(host.classList.contains("is-hidden")).toBe(false);

    frames.shift()?.(1);
    await transition;
    expect(host.classList.contains("is-hidden")).toBe(true);

    coordinator.destroy();
    vi.unstubAllGlobals();
  });

  it("releases hidden presentation and prompt targeting only after the selected session mutation completes", async () => {
    const scheduler = controlFrames(true);
    let finishMutation!: () => void;
    const mutation = new Promise<void>((resolve) => { finishMutation = resolve; });
    let presentation!: SessionTransitionCoordinator;
    const dispatch = vi.fn(async (_request: SessionMutationRequest, controller: SessionController) => {
      await mutation;
      controller.applyRuntimeSession(sessionViewModel("selected-project", {
        workspace: { kind: "project", projectId: "project:synthetic", label: "Synthetic" },
      }));
      return true;
    });
    const { controller, operations } = createSessionControllerHarness({
      dispatch,
      settlePresentation: () => presentation.settle(),
    });
    const flush = vi.fn();
    presentation = new SessionTransitionCoordinator(document.createElement("div"), operations, flush);
    presentation.open();
    controller.applyRuntimeSession(sessionViewModel("old-vault"));
    const transition = controller.restoreSession("C:/synthetic/selected-project.jsonl");
    let target: string | undefined;
    const submission = controller.ensureActiveSessionTarget().then((session) => { target = session.sessionId; });
    try {
      await flushMicrotasks();
      expect(target).toBeUndefined();
      expect(flush).not.toHaveBeenCalled();
      expect(operations.current("session-transition")).not.toBeNull();
      finishMutation();
      await vi.waitFor(() => expect(target).toBe("selected-project"));
      expect(operations.current("session-transition")).toBeNull();
      expect(dispatch).toHaveBeenCalledOnce();
      expect(flush).toHaveBeenCalledTimes(2);
      expect(scheduler.request).not.toHaveBeenCalled();
    } finally {
      finishMutation();
      await scheduler.drain();
      presentation.destroy();
      await Promise.all([transition, submission]);
    }
  });

  it("waits for the remaining visible frame when a hidden document becomes visible between flushes", async () => {
    const scheduler = controlFrames(true);
    const operations = new OperationCoordinator();
    const flush = vi.fn();
    const presentation = new SessionTransitionCoordinator(document.createElement("div"), operations, flush);
    let settled = false;
    const transition = presentation.settle().then(() => { settled = true; });
    try {
      expect(flush).toHaveBeenCalledOnce();
      scheduler.show();
      await flushMicrotasks();
      expect(flush).toHaveBeenCalledTimes(2);
      expect(scheduler.request).toHaveBeenCalledOnce();
      expect(settled).toBe(false);
      scheduler.fire();
      await transition;
      expect(settled).toBe(true);
      expect(scheduler.frames.size).toBe(0);
    } finally {
      presentation.destroy();
      await transition;
    }
  });

  it.each([0, 1])("settles when the document hides after %s frames and removes pending callbacks", async (completedFrames) => {
    const scheduler = controlFrames(false);
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");
    const operations = new OperationCoordinator();
    const flush = vi.fn();
    const presentation = new SessionTransitionCoordinator(document.createElement("div"), operations, flush);
    let settled = false;
    const transition = operations.run({ key: "session-transition", id: "session:resume", label: "Resuming" },
      () => presentation.settle()).then(() => { settled = true; });
    try {
      for (let index = 0; index < completedFrames; index++) {
        scheduler.fire();
        await flushMicrotasks();
      }
      expect(settled).toBe(false);
      const staleFrame = scheduler.frames.values().next().value;
      scheduler.hide();
      await flushMicrotasks();
      expect(settled).toBe(true);
      expect(operations.current("session-transition")).toBeNull();
      expect(flush).toHaveBeenCalledTimes(2);
      expect(scheduler.frames.size).toBe(0);
      expect(scheduler.cancel).toHaveBeenCalledOnce();
      for (const [type, listener] of addListener.mock.calls) {
        if (type === "visibilitychange") expect(removeListener).toHaveBeenCalledWith(type, listener);
      }
      staleFrame?.(0);
      document.dispatchEvent(new Event("visibilitychange"));
      await transition;
      expect(flush).toHaveBeenCalledTimes(2);
    } finally {
      presentation.destroy();
      await scheduler.drain();
      await transition;
    }
  });

  it.each([0, 1])("retires presentation on destruction after %s frames without touching a later operation", async (completedFrames) => {
    const scheduler = controlFrames(false);
    const removeListener = vi.spyOn(document, "removeEventListener");
    const operations = new OperationCoordinator();
    const flush = vi.fn();
    const presentation = new SessionTransitionCoordinator(document.createElement("div"), operations, flush);
    const transition = operations.run({ key: "session-transition", id: "session:old", label: "Resuming" },
      () => presentation.settle());
    for (let index = 0; index < completedFrames; index++) {
      scheduler.fire();
      await flushMicrotasks();
    }
    const staleFrame = scheduler.frames.values().next().value;
    presentation.destroy();
    await transition;
    expect(scheduler.frames.size).toBe(0);
    expect(scheduler.cancel).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(flush).toHaveBeenCalledTimes(completedFrames + 1);

    let finishNewOperation!: () => void;
    const newOperation = operations.run({ key: "session-transition", id: "session:new", label: "New session" },
      () => new Promise<void>((resolve) => { finishNewOperation = resolve; }));
    try {
      staleFrame?.(0);
      document.dispatchEvent(new Event("visibilitychange"));
      await presentation.settle();
      expect(operations.current("session-transition")?.id).toBe("session:new");
      expect(flush).toHaveBeenCalledTimes(completedFrames + 1);
    } finally {
      finishNewOperation();
      await newOperation;
    }
  });

  it("does not let destruction complete an unfinished backend mutation", async () => {
    const scheduler = controlFrames(false);
    const operations = new OperationCoordinator();
    const flush = vi.fn();
    const presentation = new SessionTransitionCoordinator(document.createElement("div"), operations, flush);
    let finishMutation!: () => void;
    const mutation = new Promise<void>((resolve) => { finishMutation = resolve; });
    let completed = false;
    const transition = operations.run({ key: "session-transition", id: "session:resume", label: "Resuming" }, async () => {
      await mutation;
      await presentation.settle();
    }).then(() => { completed = true; });
    try {
      presentation.destroy();
      await flushMicrotasks();
      expect(completed).toBe(false);
      expect(operations.current("session-transition")).not.toBeNull();
      finishMutation();
      await transition;
      expect(completed).toBe(true);
      expect(operations.current("session-transition")).toBeNull();
      expect(flush).not.toHaveBeenCalled();
      expect(scheduler.request).not.toHaveBeenCalled();
    } finally {
      finishMutation();
      await transition;
    }
  });
});

function controlFrames(initiallyHidden: boolean) {
  let hidden = initiallyHidden;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id); });
  const fire = () => {
    const entry = frames.entries().next().value;
    if (!entry) throw new Error("No pending presentation frame");
    frames.delete(entry[0]);
    entry[1](0);
  };
  return {
    frames, request, cancel, fire,
    hide() { hidden = true; document.dispatchEvent(new Event("visibilitychange")); },
    show() { hidden = false; document.dispatchEvent(new Event("visibilitychange")); },
    async drain() {
      for (let pass = 0; pass < 5; pass++) {
        await flushMicrotasks();
        if (frames.size) fire();
      }
    },
  };
}
