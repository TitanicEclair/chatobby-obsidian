import { describe, it, expect } from "vitest";
import { OBSIDIAN_DEFAULT_DIRECT_TOOLS } from "../../src/vendor/@chatobby/obsidian-protocol/mcp-policy";
import {
  OBSIDIAN_ALL_TOOL_NAMES,
  OBSIDIAN_BROWSER_TOOL_NAMES,
  OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
  OBSIDIAN_CLI_FAMILY_TOOL_NAMES,
  OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP,
  OBSIDIAN_CLI_SUBSTRATE_TOOL_NAMES,
  OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP,
  OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES,
  OBSIDIAN_NON_DIRECT_TOOL_NAMES,
  OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP,
  OBSIDIAN_PLUGIN_NATIVE_TOOL_NAMES,
  OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
  OBSIDIAN_RETRIEVAL_TOOL_NAMES,
  OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP,
} from "../../src/vendor/@chatobby/obsidian-protocol/mcp-tool-catalog";
import { listImplementedOperations } from "../../src/obsidian-bridge/operation-registry";

const BACKEND_PLUGIN_NATIVE_TOOL_NAMES = [
  "obsidian_get_capabilities",
  "obsidian_get_metadata",
  "obsidian_create_folder",
  "obsidian_copy_entry",
  "obsidian_move_entry",
  "obsidian_trash_entry",
  "obsidian_import_attachment",
  "obsidian_generate_link",
  "obsidian_get_links",
  "obsidian_audit_links",
  "obsidian_list_tags",
  "obsidian_list_properties",
  "obsidian_update_frontmatter",
  "obsidian_traverse_graph",
  "obsidian_list_tasks",
  "obsidian_update_task",
  "obsidian_get_editor_state",
  "obsidian_edit_editor",
  "obsidian_focus_location",
  "obsidian_get_workspace",
  "obsidian_manage_leaf",
  "obsidian_list_commands",
  "obsidian_execute_command",
  "obsidian_list_hotkeys",
] as const;

const BACKEND_RETRIEVAL_TOOL_NAMES = [
  "obsidian_vault_explore",
  "obsidian_vault_trace",
  "obsidian_vault_related",
  "obsidian_vault_hubs",
  "obsidian_vault_communities",
  "obsidian_vault_explain",
] as const;

const BACKEND_BROWSER_TOOL_NAMES = [
  "obsidian_browser_open",
  "obsidian_browser_navigate",
  "obsidian_browser_list",
  "obsidian_browser_snapshot",
  "obsidian_browser_read",
  "obsidian_browser_dom",
  "obsidian_browser_click",
  "obsidian_browser_type",
  "obsidian_browser_press",
  "obsidian_browser_wait",
  "obsidian_browser_evaluate",
  "obsidian_browser_screenshot",
  "obsidian_browser_close",
] as const;

const BACKEND_CLI_FAMILY_TOOL_NAMES = [
  "obsidian_daily_note",
  "obsidian_base",
  "obsidian_file_history",
  "obsidian_sync",
  "obsidian_bookmarks",
  "obsidian_template",
  "obsidian_plugin",
  "obsidian_appearance",
  "obsidian_quickadd",
  "obsidian_dev_diagnostics",
  "obsidian_outline",
  "obsidian_backlinks",
  "obsidian_orphans",
  "obsidian_unresolved",
  "obsidian_wordcount",
  "obsidian_deadends",
  "obsidian_recents",
  "obsidian_random",
] as const;

const BACKEND_CLI_SUBSTRATE_TOOL_NAMES = [
  "obsidian_run_cli",
  "obsidian_read_cli_result",
] as const;

describe("MCP tool catalog", () => {
  it("matches the backend chatobby-obsidian tool-name constants", () => {
    expect(OBSIDIAN_PLUGIN_NATIVE_TOOL_NAMES).toEqual([...BACKEND_PLUGIN_NATIVE_TOOL_NAMES]);
    expect(OBSIDIAN_RETRIEVAL_TOOL_NAMES).toEqual([...BACKEND_RETRIEVAL_TOOL_NAMES]);
    expect(OBSIDIAN_BROWSER_TOOL_NAMES).toEqual([...BACKEND_BROWSER_TOOL_NAMES]);
    expect(OBSIDIAN_CLI_FAMILY_TOOL_NAMES).toEqual([...BACKEND_CLI_FAMILY_TOOL_NAMES]);
    expect(OBSIDIAN_CLI_SUBSTRATE_TOOL_NAMES).toEqual([...BACKEND_CLI_SUBSTRATE_TOOL_NAMES]);
  });

  it("maps only connector-native tool names to implemented bridge operations", () => {
    const implemented = new Set(listImplementedOperations());
    const operationMaps = [
      OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
      OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP,
      OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
    ];
    for (const map of operationMaps) {
      for (const operation of Object.values(map)) {
        expect(implemented.has(operation)).toBe(true);
      }
    }
    expect(Object.keys(OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP)).toHaveLength(63);
    expect(OBSIDIAN_NON_DIRECT_TOOL_NAMES).toHaveLength(63);
  });

  it("keeps CLI process operations runtime-owned", () => {
    const implemented = new Set(listImplementedOperations());
    for (const operation of [
      ...Object.values(OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP),
      ...Object.values(OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP),
    ]) {
      expect(implemented.has(operation)).toBe(false);
    }
  });

  it("keeps the full registered tool surface at 73 canonical obsidian_* names", () => {
    expect(OBSIDIAN_DEFAULT_DIRECT_TOOLS).toHaveLength(10);
    expect(OBSIDIAN_ALL_TOOL_NAMES).toHaveLength(73);
    expect(new Set(OBSIDIAN_ALL_TOOL_NAMES).size).toBe(73);
    for (const name of OBSIDIAN_ALL_TOOL_NAMES) {
      expect(name.startsWith("obsidian_")).toBe(true);
    }
  });

  it("does not reintroduce excluded compatibility aliases", () => {
    const allTools = new Set<string>(OBSIDIAN_ALL_TOOL_NAMES);
    for (const excluded of OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES) {
      expect(allTools.has(excluded)).toBe(false);
    }
  });
});
