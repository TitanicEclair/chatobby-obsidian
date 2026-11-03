import { describe, expect, it } from "vitest";
import { createSessionTab } from "../../../src/features/session/public";
import { TabMap } from "../../../src/ui/session/tab-state";
import { EMPTY_SESSION_STATE, DEFAULT_SESSION_PREFERENCES } from "../../../src/features/session/public";
import { EMPTY_SESSION_STATE as legacyEmpty, DEFAULT_SESSION_PREFERENCES as legacyPreferences, INITIAL_COMPOSER_STATE } from "../../../src/types";

describe("TabMap", () => {
  /** @see src/features/session/README.md — preserve existing shared defaults, not a new factory. */
  it("retains facade constant identity and the constructor's existing default references", () => {
    expect(legacyEmpty).toBe(EMPTY_SESSION_STATE);
    expect(legacyPreferences).toBe(DEFAULT_SESSION_PREFERENCES);
    const first = createSessionTab("first"), second = createSessionTab("second", first);
    expect(first.sessionState).not.toBe(EMPTY_SESSION_STATE);
    expect(first.sessionState.autoCompaction).toBe(EMPTY_SESSION_STATE.autoCompaction);
    expect(first.sessionState.messages).toBe(EMPTY_SESSION_STATE.messages);
    expect(first.sessionState.activeTools).toBe(second.sessionState.activeTools);
    expect(first.composerState).toBe(INITIAL_COMPOSER_STATE);
    expect(second.composerState).toBe(INITIAL_COMPOSER_STATE);
    expect(first.feedStore).not.toBe(second.feedStore);
  });
  it("tracks active tabs", () => {
    const tabs = new TabMap();
    const first = createSessionTab("s1");
    const second = createSessionTab("s2", first);
    tabs.add(first);
    tabs.add(second);
    tabs.setActive("s2");
    expect(tabs.active()?.sessionId).toBe("s2");
    tabs.remove("s2");
    expect(tabs.active()?.sessionId).toBe("s1");
  });

  it("replaces tab ids while preserving active selection", () => {
    const tabs = new TabMap();
    tabs.add(createSessionTab("old"));
    tabs.replace("old", createSessionTab("new"));
    expect(tabs.has("old")).toBe(false);
    expect(tabs.activeTabId()).toBe("new");
  });

  it("selects the nearest tab after close", () => {
    const tabs = new TabMap();
    tabs.add(createSessionTab("s1"));
    tabs.add(createSessionTab("s2"));
    tabs.add(createSessionTab("s3"));
    tabs.setActive("s2");
    tabs.remove("s2");
    expect(tabs.activeTabId()).toBe("s3");
  });
});
