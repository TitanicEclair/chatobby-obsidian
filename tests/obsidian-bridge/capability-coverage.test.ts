// Drift guard: every connector-owned operation's capability family is advertised
// in the hello frame. Runtime-owned CLI execution is reported separately.

import { describe, it, expect } from "vitest";
import { listImplementedOperations } from "../../src/obsidian-bridge/operation-registry";
import { PLUGIN_CAPABILITIES } from "../../src/obsidian-bridge/capabilities";

function capabilityFor(op: string): string | undefined {
  if (op.startsWith("note.") || op === "context.get") return "vault";
	if (op.startsWith("links.")) return "links";
  if (op.startsWith("attachment.")) return "attachments";
  if (op.startsWith("editor.")) return "editor";
  if (op.startsWith("workspace.")) return "workspace";
  if (op.startsWith("ui.")) return "workspace";
  if (op.startsWith("browser.")) return "browser";
  return undefined;
}

describe("capability coverage", () => {
  it("advertises only connector-owned capability families", () => {
		expect(PLUGIN_CAPABILITIES).toHaveLength(6);
    expect(PLUGIN_CAPABILITIES).toEqual(
      expect.arrayContaining([
				"vault", "links", "attachments", "editor", "workspace", "browser",
      ]),
    );
    expect(PLUGIN_CAPABILITIES).not.toContain("cli");
  });

  it("every implemented operation's capability is advertised", () => {
    const advertised = new Set(PLUGIN_CAPABILITIES);
    const mapped: string[] = [];
    for (const op of listImplementedOperations()) {
      const cap = capabilityFor(op);
      if (cap === undefined) continue;
      mapped.push(`${op}→${cap}`);
      expect(advertised.has(cap)).toBe(true);
    }
		expect(mapped).toHaveLength(26);
  });
});
