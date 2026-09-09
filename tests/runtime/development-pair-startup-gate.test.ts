import { describe, expect, it, vi } from "vitest";
import { DevelopmentPairStartupGate } from "../../src/runtime/application/development-pair-startup-gate";

describe("DevelopmentPairStartupGate", () => {
  it("keeps plugin composition alive with a typed diagnostic when adoption fails", async () => {
    const gate = new DevelopmentPairStartupGate();
    const cause = new Error("raw internal failure");

    const failure = await gate.capture("managed", async () => {
      throw cause;
    }, 42);

    expect(failure?.state).toMatchObject({
      status: "error",
      mode: "managed",
      diagnostics: {
        code: "development_pair_adoption_failed",
        occurredAt: 42,
      },
    });
    expect(failure).not.toHaveProperty("cause");
    expect(failure?.state.diagnostics.message).not.toContain("raw internal failure");
  });

  it("retains the adoption diagnostic after rollback leaves the runtime idle", async () => {
    const gate = new DevelopmentPairStartupGate();
    await gate.capture("managed", async () => {
      throw new Error("bootstrap timeout");
    });

    expect(gate.runtimeState({ status: "idle", mode: "managed" })).toMatchObject({
      status: "error",
      diagnostics: { code: "development_pair_adoption_failed" },
    });
  });

  it("denies every later runtime-start caller for the lifetime of the load", async () => {
    const gate = new DevelopmentPairStartupGate();
    const start = vi.fn(() => gate.assertRuntimeStartAllowed());
    await gate.capture("managed", async () => {
      throw new Error("bootstrap timeout");
    });

    expect(start).toThrow("Restage a valid exact pair, then reload Chatobby");
    expect(start).toHaveBeenCalledOnce();

    await expect(gate.capture("managed", async () => {})).resolves.toBeNull();
    expect(() => gate.assertRuntimeStartAllowed()).toThrow("Restage a valid exact pair");
  });

  it("does not block runtime startup after a successful exact-pair check", async () => {
    const gate = new DevelopmentPairStartupGate();

    await expect(gate.capture("managed", async () => {})).resolves.toBeNull();
    expect(() => gate.assertRuntimeStartAllowed()).not.toThrow();
    expect(gate.runtimeState({ status: "idle", mode: "managed" })).toEqual({
      status: "idle",
      mode: "managed",
    });
  });
});
