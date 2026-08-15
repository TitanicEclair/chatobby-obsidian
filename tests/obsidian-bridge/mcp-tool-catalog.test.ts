import { describe, expect, it } from "vitest";
import {
  OBSIDIAN_ALL_TOOL_NAMES,
  OBSIDIAN_BROWSER_TOOL_NAMES,
  OBSIDIAN_DEFAULT_DIRECT_TOOLS,
  OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES,
  OBSIDIAN_NON_DIRECT_TOOL_NAMES,
  OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP,
} from "../../src/vendor/@chatobby/obsidian-protocol/index.js";
import { listImplementedOperations } from "../../src/obsidian-bridge/operation-registry";

describe("MCP tool catalog", () => {
  it("maps every connector specialist to one implemented bridge operation", () => {
    const implemented = new Set(listImplementedOperations());
    for (const operation of Object.values(OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP)) {
      expect(implemented.has(operation)).toBe(true);
    }
  });

  it("keeps semantic context direct and specialist details deferred", () => {
    expect(OBSIDIAN_DEFAULT_DIRECT_TOOLS).toEqual(["obsidian_context"]);
		expect(OBSIDIAN_NON_DIRECT_TOOL_NAMES).toHaveLength(21);
    expect(OBSIDIAN_ALL_TOOL_NAMES).toHaveLength(23);
    expect(OBSIDIAN_BROWSER_TOOL_NAMES).toHaveLength(14);
  });

  it("does not reintroduce excluded compatibility aliases", () => {
    const allTools = new Set<string>(OBSIDIAN_ALL_TOOL_NAMES);
    for (const excluded of OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES) {
      expect(allTools.has(excluded)).toBe(false);
    }
  });
});
