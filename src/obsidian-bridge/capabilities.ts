// Capability advertisement — the feature families this plugin supports.
// The vocabulary is the six-value ObsidianBridgeCapability union defined in the
// vendored @chatobby/obsidian-protocol (single source of truth). Advertise only
// families whose operations are actually implemented; the Chatobby bridge / MCP
// layer uses these to gate which obsidian_* tools are exposed to the agent.
//
// See docs/tooling/bridge-executor.md (hello.capabilities) and the protocol's
// bridge-capabilities.ts. Drift between this list and the implemented operation
// handlers is guarded by tests/obsidian-bridge/capability-coverage.test.ts.

import type { ObsidianBridgeCapability } from "../vendor/@chatobby/obsidian-protocol/index.js";

/**
 * Capability families advertised in the bridge hello frame.
 *
 * The connector implements only families that still require live Obsidian APIs:
 *   vault       — semantic context and exact note resolution
 *   links       — scoped broken-link audit
 *   attachments — Obsidian-aware attachment import and embed generation
 *   editor      — exact live-buffer read/edit/focus/history
 *   workspace   — workspace.get/manage
 *   browser     — the isolated Obsidian Web Viewer lifecycle
 *
 * NOTE: `hello.capabilities` is parsed against the fixed union — unknown values
 * cause the backend to close the socket with 4002 (protocol error). Only values
 * from ObsidianBridgeCapability are valid here.
 */
export const PLUGIN_CAPABILITIES: ObsidianBridgeCapability[] = [
  "vault",
  "links",
  "attachments",
  "editor",
  "workspace",
  "browser",
];
