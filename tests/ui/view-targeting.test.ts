import { describe, expect, it } from "vitest";
import { selectChatobbyCommandTarget } from "../../src/ui/controller/view-targeting";

describe("selectChatobbyCommandTarget", () => {
  const first = { id: "first" };
  const second = { id: "second" };

  it("prefers the focused Chatobby view", () => {
    expect(selectChatobbyCommandTarget(second, first, [first, second])).toBe(second);
  });

  it("uses the last-used open Chatobby view when focus is elsewhere", () => {
    expect(selectChatobbyCommandTarget(null, second, [first, second])).toBe(second);
  });

  it("ignores a stale last-used view and falls back to the first open view", () => {
    expect(selectChatobbyCommandTarget(null, { id: "closed" }, [first, second])).toBe(first);
  });

  it("returns null when no Chatobby view is open", () => {
    expect(selectChatobbyCommandTarget(null, null, [])).toBeNull();
  });
});
