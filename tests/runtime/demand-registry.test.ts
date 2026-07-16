import { describe, expect, it } from "vitest";
import { DefaultRuntimeDemandRegistry } from "../../src/runtime/application/demand-registry";

describe("DefaultRuntimeDemandRegistry", () => {
  it("deduplicates owner and kind while making release idempotent", () => {
    const registry = new DefaultRuntimeDemandRegistry();
    const first = registry.acquire("visible-view", "view-1");
    const duplicate = registry.acquire("visible-view", "view-1");

    expect(first.id).toBe(duplicate.id);
    expect(registry.snapshot()).toHaveLength(1);
    first.release();
    first.release();
    expect(registry.hasDemand()).toBe(false);
  });

  it("tracks independent semantic demand kinds", () => {
    const registry = new DefaultRuntimeDemandRegistry();
    registry.acquire("visible-view", "view-1");
    registry.acquire("pending-user-action", "action-1");

    expect(registry.hasDemand("visible-view")).toBe(true);
    expect(registry.hasDemand("background-event")).toBe(false);
    expect(registry.snapshot().map((demand) => demand.kind)).toEqual(["visible-view", "pending-user-action"]);
  });
});
