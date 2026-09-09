import { describe, expect, it } from "vitest";
import { moveBefore, orderItems, parseNavigatorState } from "../../src/features/projects/application/navigator-state";

describe("navigator layout state", () => {
  it("restores valid presentation values and rejects unrelated versions and malformed records", () => {
    expect(parseNavigatorState({ schemaVersion: 2, collapsed: ["a"] }).collapsed).toEqual([]);
    const state = parseNavigatorState({ schemaVersion: 1, collapsed: ["a", null, "a"], sessionOrder: JSON.parse('{"__proto__":["x"],"a":["one",5,"two"]}') });
    expect(state.collapsed).toEqual(["a"]);
    expect(state.sessionOrder.a).toEqual(["one", "two"]);
    expect(Object.hasOwn(state.sessionOrder, "__proto__")).toBe(false);
  });
  it("puts new items first in runtime order and preserves all identities after a move", () => {
    const ids = orderItems(["a", "b", "new", "latest"], ["b", "missing", "a"], (id) => id);
    expect(ids).toEqual(["new", "latest", "b", "a"]);
    expect(moveBefore(ids, "latest", "a")).toEqual(["new", "b", "latest", "a"]);
    expect(moveBefore(ids, "missing", "a")).toEqual(ids);
  });
});
