import { describe, expect, it, vi } from "vitest";
import { TurnAbortController } from "../../src/ui/controller/turn-abort-controller";

describe("TurnAbortController", () => {
  it("cancels interactions, signals Stop once, and waits for terminal streaming state", async () => {
    const cancelInteractions = vi.fn();
    const setStopping = vi.fn();
    const abort = vi.fn(async () => {});
    const controller = new TurnAbortController({
      cancelInteractions,
      getTransport: () => ({ isConnected: true, abort }),
      setStopping,
      setStreaming: vi.fn(),
      reportError: vi.fn(),
    });

    controller.request();
    controller.request();
    await Promise.resolve();
    expect(cancelInteractions).toHaveBeenCalledTimes(1);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(setStopping).toHaveBeenCalledWith(true);

    controller.setStreaming(false);
    controller.request();
    expect(abort).toHaveBeenCalledTimes(2);
  });

  it("clears the stopping state and reports a transport failure", async () => {
    const error = new Error("backend unavailable");
    const setStopping = vi.fn();
    const reportError = vi.fn();
    const controller = new TurnAbortController({
      cancelInteractions: vi.fn(),
      getTransport: () => ({ isConnected: true, abort: async () => Promise.reject(error) }),
      setStopping,
      setStreaming: vi.fn(),
      reportError,
    });

    controller.request();
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith(error));
    expect(setStopping).toHaveBeenLastCalledWith(false);
  });
});
