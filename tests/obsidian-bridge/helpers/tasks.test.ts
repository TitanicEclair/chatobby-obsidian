// Unit tests for the markdown task (checkbox) helper.

import { describe, it, expect } from "vitest";
import { parseTasks, setTaskStatus } from "../../../src/obsidian-bridge/operations/helpers/tasks";

const CONTENT = "# Todo\n- [ ] open\n- [x] done\n- [-] cancelled\nsome text\n- [ ] another\n";

describe("parseTasks", () => {
  it("parses checked, unchecked, and cancelled tasks", () => {
    const tasks = parseTasks("n.md", CONTENT, true);
    expect(tasks).toHaveLength(4);
    expect(tasks.map((t) => t.status)).toEqual(["unchecked", "checked", "cancelled", "unchecked"]);
    expect(tasks[0]).toMatchObject({ line: 1, text: "open", checked: false });
  });

  it("omits completed tasks when includeCompleted is false", () => {
    const tasks = parseTasks("n.md", CONTENT, false);
    expect(tasks.every((t) => t.status !== "checked")).toBe(true);
    expect(tasks).toHaveLength(3);
  });
});

describe("setTaskStatus", () => {
  it("toggles an unchecked task to checked", () => {
    const { content, changed } = setTaskStatus(CONTENT, 1, "checked");
    expect(changed).toBe(true);
    expect(content.split(/\r?\n/)[1]).toBe("- [x] open");
  });

  it("reports no change when already in that state", () => {
    expect(setTaskStatus(CONTENT, 2, "checked").changed).toBe(false);
  });

  it("throws on a non-task line", () => {
    expect(() => setTaskStatus(CONTENT, 0, "checked")).toThrow(RangeError);
  });

  it("throws on an out-of-range line", () => {
    expect(() => setTaskStatus(CONTENT, 99, "checked")).toThrow(RangeError);
  });
});
