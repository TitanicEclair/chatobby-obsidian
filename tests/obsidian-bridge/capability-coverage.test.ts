// Drift guard: every connector-owned operation's capability family is advertised
// in the hello frame. Runtime-owned CLI execution is reported separately.

import { describe, it, expect } from "vitest";
import { listImplementedOperations } from "../../src/obsidian-bridge/operation-registry";
import { PLUGIN_CAPABILITIES } from "../../src/obsidian-bridge/capabilities";

function capabilityFor(op: string): string | undefined {
  if (op === "registry.status") return undefined; // meta-introspection, no family
  if (op === "app.open") return "vault";
  if (op.startsWith("note.") || op.startsWith("vault.") || op.startsWith("folder.") || op.startsWith("entry.") || op === "context.get") return "vault";
  if (op.startsWith("metadata.") || op.startsWith("properties.") || op.startsWith("frontmatter.") || op.startsWith("tags.")) return "metadata";
  if (op.startsWith("links.") || op.startsWith("graph.")) return "links";
  if (op.startsWith("tasks.")) return "tasks";
  if (op.startsWith("attachment.")) return "attachments";
  if (op.startsWith("editor.")) return "editor";
  if (op.startsWith("workspace.")) return "workspace";
  if (op.startsWith("commands.")) return "commands";
  if (op.startsWith("hotkeys.")) return "hotkeys";
  if (op.startsWith("browser.")) return "browser";
  if (op.startsWith("retrieval.")) return "retrieval";
  if (op.startsWith("cli.")) return "cli";
  return undefined;
}

describe("capability coverage", () => {
  it("advertises only connector-owned capability families", () => {
    expect(PLUGIN_CAPABILITIES).toHaveLength(11);
    expect(PLUGIN_CAPABILITIES).toEqual(
      expect.arrayContaining([
        "vault", "metadata", "links", "tasks", "attachments",
        "editor", "workspace", "commands", "hotkeys", "browser", "retrieval",
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
    expect(mapped.length).toBeGreaterThan(40);
  });
});
