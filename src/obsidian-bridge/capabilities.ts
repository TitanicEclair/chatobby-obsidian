// Capability advertisement — the feature families this plugin supports.
// The vocabulary is the 12-value ObsidianBridgeCapability union defined in the
// vendored @chatobby/obsidian-protocol (single source of truth). Advertise only
// families whose operations are actually implemented; the Chatobby bridge / MCP
// layer uses these to gate which obsidian_* tools are exposed to the agent.
//
// See docs/tooling/bridge-executor.md (hello.capabilities) and the protocol's
// bridge-capabilities.ts. Drift between this list and the implemented operation
// handlers is guarded by tests/obsidian-bridge/capability-coverage.test.ts.

import type { ObsidianBridgeCapability } from "../vendor/@chatobby/obsidian-protocol";

/**
 * Capability families advertised in the bridge hello frame.
 *
 * The connector implements the 11 families that require live Obsidian APIs:
 *   vault       — core read/write/search/list + folder.create + entry.copy/move/trash
 *   metadata    — metadata.get, properties.list, frontmatter.update, tags.list
 *   links       — links.generate/get/audit, graph.traverse
 *   tasks       — tasks.list, tasks.update
 *   attachments — attachment.read, attachment.import
 *   editor      — editor.get/edit/focus
 *   workspace   — workspace.get/manage
 *   commands    — commands.list/execute
 *   hotkeys     — hotkeys.list
 *   browser     — browser.open/list/read/close over Obsidian Web viewer
 *   retrieval   — retrieval.explore/trace/related/hubs/communities/explain
 *                 (Graphify artifact + Smart Connections, with lexical fallback)
 *
 * The `cli` family is deliberately absent. Bounded Obsidian CLI execution is
 * runtime-owned; availability is reported through `runtimeDependencies`.
 *
 * NOTE: `hello.capabilities` is parsed against the fixed union — unknown values
 * cause the backend to close the socket with 4002 (protocol error). Only values
 * from ObsidianBridgeCapability are valid here.
 */
export const PLUGIN_CAPABILITIES: ObsidianBridgeCapability[] = [
  "vault",
  "metadata",
  "links",
  "tasks",
  "attachments",
  "editor",
  "workspace",
  "commands",
  "hotkeys",
  "browser",
  "retrieval",
];
