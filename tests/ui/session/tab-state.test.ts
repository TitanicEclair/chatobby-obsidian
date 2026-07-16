import { describe, expect, it } from "vitest";
import { createSessionTab } from "../../../src/features/session/public";
import { TabMap } from "../../../src/ui/session/tab-state";

describe("TabMap", () => {
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
