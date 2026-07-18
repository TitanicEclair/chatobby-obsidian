// packages/chatobby-obsidian-protocol/src/bridge-capabilities.ts
var OBSIDIAN_BRIDGE_CAPABILITIES = [
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
  "cli"
];
var OBSIDIAN_BRIDGE_CAPABILITY_SET = new Set(OBSIDIAN_BRIDGE_CAPABILITIES);
function isBridgeCapability(value) {
  return OBSIDIAN_BRIDGE_CAPABILITY_SET.has(value);
}

// packages/chatobby-obsidian-protocol/src/bridge-errors.ts
var OBSIDIAN_BRIDGE_PROTOCOL_VERSION = 1;
var OBSIDIAN_BRIDGE_ERROR_CODES = /* @__PURE__ */ new Set([
  "OBSIDIAN_UNAVAILABLE",
  "BRIDGE_PROTOCOL_MISMATCH",
  "OBSIDIAN_VAULT_AMBIGUOUS",
  "OBSIDIAN_BRIDGE_DISCONNECTED",
  "DEADLINE_EXCEEDED",
  "OPERATION_CANCELLED",
  "NOTE_NOT_FOUND",
  "PATH_AMBIGUOUS",
  "REVISION_CONFLICT",
  "PATH_EXISTS",
  "INVALID_INPUT",
  "UNSUPPORTED_OPERATION",
  "COMMAND_NOT_ALLOWED",
  "OBSIDIAN_OPERATION_FAILED",
  "OBSIDIAN_CLI_NOT_FOUND",
  "OBSIDIAN_CLI_FAILED",
  "CLI_RESULT_NOT_FOUND"
]);
function parseBridgeErrorPayload(input) {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Bridge error payload must be an object");
  }
  const obj = input;
  if (typeof obj.code !== "string" || !OBSIDIAN_BRIDGE_ERROR_CODES.has(obj.code)) {
    throw new TypeError(`Invalid bridge error code: ${String(obj.code)}`);
  }
  if (typeof obj.message !== "string") {
    throw new TypeError("Bridge error message must be a string");
  }
  if (typeof obj.retryable !== "boolean") {
    throw new TypeError("Bridge error retryable must be a boolean");
  }
  return {
    code: obj.code,
    message: obj.message,
    retryable: obj.retryable,
    ...obj.details !== void 0 ? { details: obj.details } : {}
  };
}

// packages/chatobby-obsidian-protocol/src/bridge-operations.ts
var OBSIDIAN_CORE_OPERATIONS = [
  "context.get",
  "note.resolve",
  "note.read",
  "vault.search",
  "attachment.read",
  "vault.list",
  "note.write",
  "note.edit",
  "note.open",
  "app.open"
];
var OBSIDIAN_PLUGIN_NATIVE_OPERATIONS = [
  "registry.status",
  "metadata.get",
  "folder.create",
  "entry.copy",
  "entry.move",
  "entry.trash",
  "attachment.import",
  "links.generate",
  "tags.list",
  "properties.list",
  "frontmatter.update",
  "links.get",
  "links.audit",
  "graph.traverse",
  "tasks.list",
  "tasks.update",
  "editor.get",
  "editor.edit",
  "editor.focus",
  "workspace.get",
  "workspace.manage",
  "commands.list",
  "commands.execute",
  "hotkeys.list"
];
var OBSIDIAN_BROWSER_OPERATIONS = [
  "browser.open",
  "browser.navigate",
  "browser.list",
  "browser.snapshot",
  "browser.read",
  "browser.dom",
  "browser.click",
  "browser.pointer",
  "browser.type",
  "browser.press",
  "browser.wait",
  "browser.screenshot",
  "browser.close"
];
var OBSIDIAN_RETRIEVAL_OPERATIONS = [
  "retrieval.explore",
  "retrieval.trace",
  "retrieval.related",
  "retrieval.hubs",
  "retrieval.communities",
  "retrieval.explain"
];
var OBSIDIAN_CLI_OPERATIONS = [
  "cli.result.read",
  "cli.daily",
  "cli.base",
  "cli.fileHistory",
  "cli.sync",
  "cli.bookmarks",
  "cli.template",
  "cli.plugin",
  "cli.appearance",
  "cli.quickadd",
  "cli.devDiagnostics",
  "cli.run",
  "cli.outline",
  "cli.backlinks",
  "cli.orphans",
  "cli.unresolved",
  "cli.wordcount",
  "cli.deadends",
  "cli.recents",
  "cli.random"
];
var OBSIDIAN_ALL_OPERATIONS = /* @__PURE__ */ new Set([
  ...OBSIDIAN_CORE_OPERATIONS,
  ...OBSIDIAN_PLUGIN_NATIVE_OPERATIONS,
  ...OBSIDIAN_BROWSER_OPERATIONS,
  ...OBSIDIAN_RETRIEVAL_OPERATIONS,
  ...OBSIDIAN_CLI_OPERATIONS
]);
function isOperationName(value) {
  if (OBSIDIAN_ALL_OPERATIONS.has(value)) {
    return true;
  }
  return value.startsWith("cli.native.") && value.length > "cli.native.".length;
}

// packages/chatobby-obsidian-protocol/src/bridge-protocol.ts
function isPlainObject(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}
function parseVault(input) {
  if (!isPlainObject(input)) throw new TypeError("Vault must be an object");
  if (typeof input.id !== "string") throw new TypeError("Vault id must be a string");
  if (typeof input.name !== "string") throw new TypeError("Vault name must be a string");
  const result = { id: input.id, name: input.name };
  if (input.root !== void 0) {
    if (typeof input.root !== "string") throw new TypeError("Vault root must be a string");
    result.root = input.root;
  }
  return result;
}
function parseEnabledPlugin(input) {
  if (!isPlainObject(input)) throw new TypeError("Enabled plugin must be an object");
  if (typeof input.id !== "string") throw new TypeError("Enabled plugin id must be a string");
  const result = { id: input.id };
  if (input.name !== void 0) {
    if (typeof input.name !== "string") throw new TypeError("Enabled plugin name must be a string");
    result.name = input.name;
  }
  if (input.version !== void 0) {
    if (typeof input.version !== "string") throw new TypeError("Enabled plugin version must be a string");
    result.version = input.version;
  }
  return result;
}
function parsePluginState(input) {
  if (!isPlainObject(input)) throw new TypeError("Plugin state must be an object");
  if (typeof input.id !== "string" || typeof input.name !== "string") {
    throw new TypeError("Plugin state requires string id and name");
  }
  if (input.kind !== "community" && input.kind !== "core") throw new TypeError("Plugin state kind is invalid");
  if (typeof input.installed !== "boolean" || typeof input.enabled !== "boolean") {
    throw new TypeError("Plugin state requires installed and enabled booleans");
  }
  return {
    id: input.id,
    name: input.name,
    ...typeof input.version === "string" ? { version: input.version } : {},
    kind: input.kind,
    installed: input.installed,
    enabled: input.enabled
  };
}
function parseRuntimeDependency(input) {
  if (!isPlainObject(input)) throw new TypeError("Runtime dependency must be an object");
  if (typeof input.id !== "string" || typeof input.name !== "string" || typeof input.available !== "boolean") {
    throw new TypeError("Runtime dependency requires id, name, and available state");
  }
  return {
    id: input.id,
    name: input.name,
    available: input.available,
    ...typeof input.detail === "string" ? { detail: input.detail } : {}
  };
}
function parseCapabilities(input) {
  if (!Array.isArray(input)) throw new TypeError("capabilities must be an array");
  return input.map((capability) => {
    if (typeof capability !== "string") throw new TypeError("Capability must be a string");
    if (!isBridgeCapability(capability)) throw new TypeError(`Unknown bridge capability: ${capability}`);
    return capability;
  });
}
function parseHello(input) {
  if (typeof input.authToken !== "string") throw new TypeError("hello.authToken must be a string");
  if (input.protocolVersion !== OBSIDIAN_BRIDGE_PROTOCOL_VERSION) {
    throw new TypeError(
      `Protocol version mismatch: expected ${OBSIDIAN_BRIDGE_PROTOCOL_VERSION}, got ${String(input.protocolVersion)}`
    );
  }
  if (typeof input.connectionId !== "string") throw new TypeError("hello.connectionId must be a string");
  if (typeof input.appVersion !== "string") throw new TypeError("hello.appVersion must be a string");
  if (typeof input.pluginVersion !== "string") throw new TypeError("hello.pluginVersion must be a string");
  const capabilities = parseCapabilities(input.capabilities);
  const result = {
    type: "hello",
    authToken: input.authToken,
    protocolVersion: 1,
    connectionId: input.connectionId,
    vault: parseVault(input.vault),
    appVersion: input.appVersion,
    pluginVersion: input.pluginVersion,
    capabilities
  };
  if (input.enabledPlugins !== void 0) {
    if (!Array.isArray(input.enabledPlugins)) throw new TypeError("hello.enabledPlugins must be an array");
    result.enabledPlugins = input.enabledPlugins.map(parseEnabledPlugin);
  }
  if (input.plugins !== void 0) {
    if (!Array.isArray(input.plugins)) throw new TypeError("hello.plugins must be an array");
    result.plugins = input.plugins.map(parsePluginState);
  }
  if (input.runtimeDependencies !== void 0) {
    if (!Array.isArray(input.runtimeDependencies)) throw new TypeError("hello.runtimeDependencies must be an array");
    result.runtimeDependencies = input.runtimeDependencies.map(parseRuntimeDependency);
  }
  return result;
}
function parseCapabilitiesChanged(input) {
  if (!Array.isArray(input.plugins) || !Array.isArray(input.runtimeDependencies)) {
    throw new TypeError("capabilities_changed requires plugin and runtime dependency arrays");
  }
  return {
    type: "capabilities_changed",
    capabilities: parseCapabilities(input.capabilities),
    plugins: input.plugins.map(parsePluginState),
    runtimeDependencies: input.runtimeDependencies.map(parseRuntimeDependency)
  };
}
function parsePing(input) {
  if (typeof input.sentAt !== "string") throw new TypeError("ping.sentAt must be a string");
  const result = { type: "ping", sentAt: input.sentAt };
  if (input.requestId !== void 0) {
    if (typeof input.requestId !== "string") throw new TypeError("ping.requestId must be a string");
    result.requestId = input.requestId;
  }
  return result;
}
function parseResult(input) {
  if (typeof input.requestId !== "string") throw new TypeError("result.requestId must be a string");
  return { type: "result", requestId: input.requestId, result: input.result };
}
function parseError(input) {
  if (typeof input.requestId !== "string") throw new TypeError("error.requestId must be a string");
  return {
    type: "error",
    requestId: input.requestId,
    error: parseBridgeErrorPayload(input.error)
  };
}
function parsePong(input) {
  if (typeof input.sentAt !== "string") throw new TypeError("pong.sentAt must be a string");
  const result = { type: "pong", sentAt: input.sentAt };
  if (input.requestId !== void 0) {
    if (typeof input.requestId !== "string") throw new TypeError("pong.requestId must be a string");
    result.requestId = input.requestId;
  }
  return result;
}
var VALID_CANCEL_REASONS = /* @__PURE__ */ new Set(["timeout", "client_abort", "disconnect", "shutdown"]);
function parseInvoke(input) {
  if (typeof input.requestId !== "string") throw new TypeError("invoke.requestId must be a string");
  if (typeof input.operation !== "string") throw new TypeError("invoke.operation must be a string");
  if (!isOperationName(input.operation)) {
    throw new TypeError(`Invalid operation name: ${input.operation}`);
  }
  if (!isPlainObject(input.arguments)) throw new TypeError("invoke.arguments must be an object");
  if (typeof input.deadline !== "string") throw new TypeError("invoke.deadline must be a string");
  return {
    type: "invoke",
    requestId: input.requestId,
    operation: input.operation,
    arguments: input.arguments,
    deadline: input.deadline
  };
}
function parseCancel(input) {
  if (typeof input.requestId !== "string") throw new TypeError("cancel.requestId must be a string");
  if (typeof input.reason !== "string" || !VALID_CANCEL_REASONS.has(input.reason)) {
    throw new TypeError(`Invalid cancel reason: ${String(input.reason)}`);
  }
  return {
    type: "cancel",
    requestId: input.requestId,
    reason: input.reason
  };
}
function parsePluginToServerMessage(input) {
  if (!isPlainObject(input)) {
    throw new TypeError("Bridge message must be a non-null object");
  }
  const type = input.type;
  switch (type) {
    case "hello":
      return parseHello(input);
    case "ping":
      return parsePing(input);
    case "capabilities_changed":
      return parseCapabilitiesChanged(input);
    case "result":
      return parseResult(input);
    case "error":
      return parseError(input);
    default:
      throw new TypeError(`Unknown plugin-to-server message type: ${String(type)}`);
  }
}
function parseServerToPluginMessage(input) {
  if (!isPlainObject(input)) {
    throw new TypeError("Bridge message must be a non-null object");
  }
  const type = input.type;
  switch (type) {
    case "pong":
      return parsePong(input);
    case "invoke":
      return parseInvoke(input);
    case "cancel":
      return parseCancel(input);
    default:
      throw new TypeError(`Unknown server-to-plugin message type: ${String(type)}`);
  }
}

// packages/chatobby-obsidian-protocol/src/bridge-selectors.ts
var SELECTOR_KEYS = /* @__PURE__ */ new Set(["vaultId", "vaultName", "vaultRoot"]);
function parseVaultSelector(input) {
  if (input === void 0 || input === null) {
    return {};
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Vault selector must be an object");
  }
  const obj = input;
  const result = {};
  for (const key of Object.keys(obj)) {
    if (!SELECTOR_KEYS.has(key)) {
      throw new TypeError(`Unknown vault selector field: ${key}`);
    }
  }
  if (obj.vaultId !== void 0) {
    if (typeof obj.vaultId !== "string") {
      throw new TypeError("vaultId must be a string");
    }
    result.vaultId = obj.vaultId;
  }
  if (obj.vaultName !== void 0) {
    if (typeof obj.vaultName !== "string") {
      throw new TypeError("vaultName must be a string");
    }
    result.vaultName = obj.vaultName;
  }
  if (obj.vaultRoot !== void 0) {
    if (typeof obj.vaultRoot !== "string") {
      throw new TypeError("vaultRoot must be a string");
    }
    result.vaultRoot = obj.vaultRoot;
  }
  return result;
}

// packages/chatobby-obsidian-protocol/src/mcp-policy.ts
var OBSIDIAN_DEFAULT_DIRECT_TOOLS = [
  "obsidian_get_context",
  "obsidian_resolve_note",
  "obsidian_read_note",
  "obsidian_search",
  "obsidian_read_image",
  "obsidian_list_entries",
  "obsidian_create_note",
  "obsidian_edit_note",
  "obsidian_open_note",
  "obsidian_open_app"
];
var DEFAULT_BRIDGE_TIMEOUT_MS = 3e4;
var DEFAULT_CLI_TIMEOUT_MS = 3e4;
var DEFAULT_IDLE_TIMEOUT_MINUTES = 10;
function createObsidianMcpServerPolicy(options) {
  const lifecycle = options?.lifecycle ?? "eager";
  const idleTimeout = options?.idleTimeoutMinutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES;
  const directTools = options?.directTools ?? OBSIDIAN_DEFAULT_DIRECT_TOOLS;
  const excludeTools = options?.excludeTools ?? [];
  const env = {};
  if (options?.bridgeUrl !== void 0) {
    env.CHATOBBY_OBSIDIAN_BRIDGE_URL = options.bridgeUrl;
  }
  if (options?.bridgeToken !== void 0) {
    env.CHATOBBY_OBSIDIAN_BRIDGE_TOKEN = options.bridgeToken;
  }
  if (options?.cliPath !== void 0) {
    env.CHATOBBY_OBSIDIAN_CLI = options.cliPath;
  }
  if (options?.cliResultsDir !== void 0) {
    env.CHATOBBY_OBSIDIAN_CLI_RESULTS_DIR = options.cliResultsDir;
  }
  env.CHATOBBY_OBSIDIAN_BRIDGE_TIMEOUT_MS = String(options?.bridgeTimeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS);
  env.CHATOBBY_OBSIDIAN_CLI_TIMEOUT_MS = String(options?.cliTimeoutMs ?? DEFAULT_CLI_TIMEOUT_MS);
  return {
    serverName: "chatobby-obsidian",
    // Logical entry: the published bin name. The SDK layer
    // (createObsidianServerEntry) resolves this to a concrete `node <abs path>`
    // invocation at runtime when the MCP server package is installed; this
    // browser-safe default is the fallback when resolution is not possible
    // (e.g. inside a sealed binary that bundles the server itself).
    command: "chatobby-obsidian",
    args: [],
    env,
    lifecycle,
    idleTimeout,
    directTools,
    excludeTools
  };
}

// packages/chatobby-obsidian-protocol/src/mcp-tool-catalog.ts
var OBSIDIAN_DIRECT_TOOL_OPERATION_MAP = {
  obsidian_get_context: "context.get",
  obsidian_resolve_note: "note.resolve",
  obsidian_read_note: "note.read",
  obsidian_search: "vault.search",
  obsidian_read_image: "attachment.read",
  obsidian_list_entries: "vault.list",
  obsidian_create_note: "note.write",
  obsidian_edit_note: "note.edit",
  obsidian_open_note: "note.open",
  obsidian_open_app: "app.open"
};
var OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP = {
  obsidian_get_capabilities: "registry.status",
  obsidian_get_metadata: "metadata.get",
  obsidian_create_folder: "folder.create",
  obsidian_copy_entry: "entry.copy",
  obsidian_move_entry: "entry.move",
  obsidian_trash_entry: "entry.trash",
  obsidian_import_attachment: "attachment.import",
  obsidian_generate_link: "links.generate",
  obsidian_get_links: "links.get",
  obsidian_audit_links: "links.audit",
  obsidian_list_tags: "tags.list",
  obsidian_list_properties: "properties.list",
  obsidian_update_frontmatter: "frontmatter.update",
  obsidian_traverse_graph: "graph.traverse",
  obsidian_list_tasks: "tasks.list",
  obsidian_update_task: "tasks.update",
  obsidian_get_editor_state: "editor.get",
  obsidian_edit_editor: "editor.edit",
  obsidian_focus_location: "editor.focus",
  obsidian_get_workspace: "workspace.get",
  obsidian_manage_leaf: "workspace.manage",
  obsidian_list_commands: "commands.list",
  obsidian_execute_command: "commands.execute",
  obsidian_list_hotkeys: "hotkeys.list"
};
var OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP = {
  obsidian_vault_explore: "retrieval.explore",
  obsidian_vault_trace: "retrieval.trace",
  obsidian_vault_related: "retrieval.related",
  obsidian_vault_hubs: "retrieval.hubs",
  obsidian_vault_communities: "retrieval.communities",
  obsidian_vault_explain: "retrieval.explain"
};
var OBSIDIAN_BROWSER_TOOL_OPERATION_MAP = {
  obsidian_browser_open: "browser.open",
  obsidian_browser_navigate: "browser.navigate",
  obsidian_browser_list: "browser.list",
  obsidian_browser_snapshot: "browser.snapshot",
  obsidian_browser_read: "browser.read",
  obsidian_browser_dom: "browser.dom",
  obsidian_browser_click: "browser.click",
  obsidian_browser_pointer: "browser.pointer",
  obsidian_browser_type: "browser.type",
  obsidian_browser_press: "browser.press",
  obsidian_browser_wait: "browser.wait",
  obsidian_browser_screenshot: "browser.screenshot",
  obsidian_browser_close: "browser.close"
};
var OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP = {
  obsidian_daily_note: "cli.daily",
  obsidian_base: "cli.base",
  obsidian_file_history: "cli.fileHistory",
  obsidian_sync: "cli.sync",
  obsidian_bookmarks: "cli.bookmarks",
  obsidian_template: "cli.template",
  obsidian_plugin: "cli.plugin",
  obsidian_appearance: "cli.appearance",
  obsidian_quickadd: "cli.quickadd",
  obsidian_dev_diagnostics: "cli.devDiagnostics",
  obsidian_outline: "cli.outline",
  obsidian_backlinks: "cli.backlinks",
  obsidian_orphans: "cli.orphans",
  obsidian_unresolved: "cli.unresolved",
  obsidian_wordcount: "cli.wordcount",
  obsidian_deadends: "cli.deadends",
  obsidian_recents: "cli.recents",
  obsidian_random: "cli.random"
};
var OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP = {
  obsidian_run_cli: "cli.run",
  obsidian_read_cli_result: "cli.result.read"
};
var OBSIDIAN_PLUGIN_NATIVE_TOOL_NAMES = Object.keys(
  OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP
);
var OBSIDIAN_RETRIEVAL_TOOL_NAMES = Object.keys(
  OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP
);
var OBSIDIAN_BROWSER_TOOL_NAMES = Object.keys(
  OBSIDIAN_BROWSER_TOOL_OPERATION_MAP
);
var OBSIDIAN_CLI_FAMILY_TOOL_NAMES = Object.keys(
  OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP
);
var OBSIDIAN_CLI_SUBSTRATE_TOOL_NAMES = Object.keys(
  OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP
);
var OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP = {
  ...OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
  ...OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP,
  ...OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
  ...OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP,
  ...OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP
};
var OBSIDIAN_NON_DIRECT_TOOL_NAMES = Object.keys(
  OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP
);
var OBSIDIAN_ALL_TOOL_OPERATION_MAP = {
  ...OBSIDIAN_DIRECT_TOOL_OPERATION_MAP,
  ...OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP
};
var OBSIDIAN_ALL_TOOL_NAMES = Object.keys(OBSIDIAN_ALL_TOOL_OPERATION_MAP);
var OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES = [
  "vault_*",
  "open_note",
  "get_active_note",
  "execute_command",
  "manage_workspace",
  "open_obsidian_app",
  "run_obsidian_cli"
];

// packages/chatobby-obsidian-protocol/src/retrieval-protocol.ts
var VALID_BACKEND_NAMES = /* @__PURE__ */ new Set(["graphify", "smart-connections", "lexical", "obsidian-links", "plugin-finalized"]);
var VALID_WARNING_CODES = /* @__PURE__ */ new Set([
  "GRAPHIFY_UNAVAILABLE",
  "SMART_CONNECTIONS_UNAVAILABLE",
  "EMBEDDING_FAILED",
  "STALE_COMPONENT_DATA",
  "PLUGIN_FINALIZED"
]);
function parseBackendStatus(input) {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Backend status must be an object");
  }
  const obj = input;
  if (typeof obj.name !== "string" || !VALID_BACKEND_NAMES.has(obj.name)) {
    throw new TypeError(`Invalid backend name: ${String(obj.name)}`);
  }
  if (typeof obj.available !== "boolean") {
    throw new TypeError("Backend available must be a boolean");
  }
  const result = {
    name: obj.name,
    available: obj.available
  };
  if (obj.stale !== void 0) {
    if (typeof obj.stale !== "boolean") throw new TypeError("Backend stale must be a boolean");
    result.stale = obj.stale;
  }
  if (obj.sourceMtime !== void 0) {
    if (typeof obj.sourceMtime !== "number") throw new TypeError("Backend sourceMtime must be a number");
    result.sourceMtime = obj.sourceMtime;
  }
  if (obj.reason !== void 0) {
    if (typeof obj.reason !== "string") throw new TypeError("Backend reason must be a string");
    result.reason = obj.reason;
  }
  return result;
}
function parseWarning(input) {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Retrieval warning must be an object");
  }
  const obj = input;
  if (typeof obj.code !== "string" || !VALID_WARNING_CODES.has(obj.code)) {
    throw new TypeError(`Invalid retrieval warning code: ${String(obj.code)}`);
  }
  if (typeof obj.message !== "string") {
    throw new TypeError("Retrieval warning message must be a string");
  }
  return { code: obj.code, message: obj.message };
}
function parseGraphComponent(input) {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Graph component must be an object");
  }
  const obj = input;
  if (!Array.isArray(obj.nodes)) throw new TypeError("Graph nodes must be an array");
  const nodes = obj.nodes.map((n) => {
    if (n === null || typeof n !== "object") throw new TypeError("Graph node must be an object");
    const node = n;
    if (typeof node.path !== "string") throw new TypeError("Graph node path must be a string");
    const result2 = { path: node.path };
    if (node.label !== void 0) {
      if (typeof node.label !== "string") throw new TypeError("Graph node label must be a string");
      result2.label = node.label;
    }
    if (node.degree !== void 0) {
      if (typeof node.degree !== "number") throw new TypeError("Graph node degree must be a number");
      result2.degree = node.degree;
    }
    if (node.communityId !== void 0) {
      if (typeof node.communityId !== "string") throw new TypeError("Graph node communityId must be a string");
      result2.communityId = node.communityId;
    }
    return result2;
  });
  if (!Array.isArray(obj.edges)) throw new TypeError("Graph edges must be an array");
  const edges = obj.edges.map((e) => {
    if (e === null || typeof e !== "object") throw new TypeError("Graph edge must be an object");
    const edge = e;
    if (typeof edge.sourcePath !== "string") throw new TypeError("Graph edge sourcePath must be a string");
    if (typeof edge.targetPath !== "string") throw new TypeError("Graph edge targetPath must be a string");
    const result2 = {
      sourcePath: edge.sourcePath,
      targetPath: edge.targetPath
    };
    if (edge.weight !== void 0) {
      if (typeof edge.weight !== "number") throw new TypeError("Graph edge weight must be a number");
      result2.weight = edge.weight;
    }
    if (edge.type !== void 0) {
      if (typeof edge.type !== "string") throw new TypeError("Graph edge type must be a string");
      result2.type = edge.type;
    }
    return result2;
  });
  const result = { nodes, edges };
  if (obj.communities !== void 0) {
    if (!Array.isArray(obj.communities)) throw new TypeError("Graph communities must be an array");
    result.communities = obj.communities.map((c) => {
      if (c === null || typeof c !== "object") throw new TypeError("Community must be an object");
      const comm = c;
      if (typeof comm.id !== "string") throw new TypeError("Community id must be a string");
      const entry = { id: comm.id };
      if (comm.label !== void 0) {
        if (typeof comm.label !== "string") throw new TypeError("Community label must be a string");
        entry.label = comm.label;
      }
      if (comm.hubPaths !== void 0) {
        if (!Array.isArray(comm.hubPaths)) throw new TypeError("Community hubPaths must be an array");
        entry.hubPaths = comm.hubPaths.map((h) => {
          if (typeof h !== "string") throw new TypeError("Hub path must be a string");
          return h;
        });
      }
      return entry;
    });
  }
  if (obj.source !== void 0) {
    if (obj.source !== "merged" && obj.source !== "graphify" && obj.source !== "obsidian-links") {
      throw new TypeError("Graph source must be merged, graphify, or obsidian-links");
    }
    result.source = obj.source;
  }
  return result;
}
function parseSemanticHit(input) {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Semantic hit must be an object");
  }
  const obj = input;
  if (typeof obj.path !== "string") throw new TypeError("Semantic hit path must be a string");
  if (typeof obj.score !== "number") throw new TypeError("Semantic hit score must be a number");
  const result = { path: obj.path, score: obj.score };
  if (obj.model !== void 0) {
    if (typeof obj.model !== "string") throw new TypeError("Semantic hit model must be a string");
    result.model = obj.model;
  }
  if (obj.provider !== void 0) {
    if (typeof obj.provider !== "string") throw new TypeError("Semantic hit provider must be a string");
    result.provider = obj.provider;
  }
  if (obj.excerpt !== void 0) {
    if (typeof obj.excerpt !== "string") throw new TypeError("Semantic hit excerpt must be a string");
    result.excerpt = obj.excerpt;
  }
  return result;
}
function parseEvidence(input) {
  if (input === null || typeof input !== "object") throw new TypeError("Retrieval evidence must be an object");
  const obj = input;
  if (obj.provider !== "lexical" && obj.provider !== "obsidian-links" && obj.provider !== "graphify" && obj.provider !== "smart-connections") {
    throw new TypeError(`Invalid retrieval evidence provider: ${String(obj.provider)}`);
  }
  const validKinds = /* @__PURE__ */ new Set([
    "content-match",
    "path-match",
    "alias-match",
    "tag-match",
    "property-match",
    "wikilink",
    "backlink",
    "graph-edge",
    "semantic-vector",
    "community",
    "hub"
  ]);
  if (typeof obj.kind !== "string" || !validKinds.has(obj.kind)) {
    throw new TypeError(`Invalid retrieval evidence kind: ${String(obj.kind)}`);
  }
  const result = {
    provider: obj.provider,
    kind: obj.kind
  };
  for (const key of ["excerpt", "sourcePath", "targetPath", "relation", "model"]) {
    if (obj[key] !== void 0) {
      if (typeof obj[key] !== "string") throw new TypeError(`Retrieval evidence ${key} must be a string`);
      result[key] = obj[key];
    }
  }
  if (obj.score !== void 0) {
    if (typeof obj.score !== "number") throw new TypeError("Retrieval evidence score must be a number");
    result.score = obj.score;
  }
  if (obj.stale !== void 0) {
    if (typeof obj.stale !== "boolean") throw new TypeError("Retrieval evidence stale must be a boolean");
    result.stale = obj.stale;
  }
  return result;
}
function parseCandidate(input) {
  if (input === null || typeof input !== "object") throw new TypeError("Retrieval candidate must be an object");
  const obj = input;
  if (typeof obj.path !== "string") throw new TypeError("Retrieval candidate path must be a string");
  if (typeof obj.score !== "number") throw new TypeError("Retrieval candidate score must be a number");
  if (obj.confidence !== "exact" && obj.confidence !== "strong" && obj.confidence !== "weak" && obj.confidence !== "lead") {
    throw new TypeError("Retrieval candidate confidence must be exact, strong, weak, or lead");
  }
  if (!Array.isArray(obj.evidence)) throw new TypeError("Retrieval candidate evidence must be an array");
  if (typeof obj.needsRead !== "boolean") throw new TypeError("Retrieval candidate needsRead must be a boolean");
  const result = {
    path: obj.path,
    score: obj.score,
    confidence: obj.confidence,
    evidence: obj.evidence.map(parseEvidence),
    needsRead: obj.needsRead
  };
  if (obj.title !== void 0) {
    if (typeof obj.title !== "string") throw new TypeError("Retrieval candidate title must be a string");
    result.title = obj.title;
  }
  return result;
}
function parseDiagnostics(input) {
  if (input === null || typeof input !== "object") throw new TypeError("Retrieval diagnostics must be an object");
  return input;
}
function parseRetrievalEnvelope(input) {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Retrieval envelope must be an object");
  }
  const obj = input;
  if (typeof obj.available !== "boolean") {
    throw new TypeError("Retrieval envelope available must be a boolean");
  }
  if (typeof obj.partial !== "boolean") {
    throw new TypeError("Retrieval envelope partial must be a boolean");
  }
  if (!Array.isArray(obj.backends)) {
    throw new TypeError("Retrieval envelope backends must be an array");
  }
  if (!Array.isArray(obj.warnings)) {
    throw new TypeError("Retrieval envelope warnings must be an array");
  }
  const result = {
    available: obj.available,
    partial: obj.partial,
    backends: obj.backends.map(parseBackendStatus),
    warnings: obj.warnings.map(parseWarning)
  };
  if (obj.query !== void 0) {
    if (typeof obj.query !== "string") throw new TypeError("Retrieval envelope query must be a string");
    result.query = obj.query;
  }
  if (obj.subjectPath !== void 0) {
    if (typeof obj.subjectPath !== "string") throw new TypeError("Retrieval envelope subjectPath must be a string");
    result.subjectPath = obj.subjectPath;
  }
  if (obj.graph !== void 0) {
    result.graph = parseGraphComponent(obj.graph);
  }
  if (obj.semanticHits !== void 0) {
    if (!Array.isArray(obj.semanticHits)) throw new TypeError("Semantic hits must be an array");
    result.semanticHits = obj.semanticHits.map(parseSemanticHit);
  }
  if (obj.candidates !== void 0) {
    if (!Array.isArray(obj.candidates)) throw new TypeError("Retrieval candidates must be an array");
    result.candidates = obj.candidates.map(parseCandidate);
  }
  if (obj.diagnostics !== void 0) {
    result.diagnostics = parseDiagnostics(obj.diagnostics);
  }
  return result;
}

// packages/chatobby-obsidian-protocol/src/tool-capabilities.ts
var TOOL_PLUGIN_REQUIREMENTS = {
  obsidian_browser_open: ["webviewer"],
  obsidian_browser_navigate: ["webviewer"],
  obsidian_browser_list: ["webviewer"],
  obsidian_browser_snapshot: ["webviewer"],
  obsidian_browser_read: ["webviewer"],
  obsidian_browser_dom: ["webviewer"],
  obsidian_browser_click: ["webviewer"],
  obsidian_browser_pointer: ["webviewer"],
  obsidian_browser_type: ["webviewer"],
  obsidian_browser_press: ["webviewer"],
  obsidian_browser_wait: ["webviewer"],
  obsidian_browser_screenshot: ["webviewer"],
  obsidian_browser_close: ["webviewer"],
  obsidian_daily_note: ["daily-notes"],
  obsidian_base: ["bases"],
  obsidian_file_history: ["file-recovery"],
  obsidian_sync: ["sync"],
  obsidian_bookmarks: ["bookmarks"],
  obsidian_template: ["templates"],
  obsidian_quickadd: ["quickadd"]
};
var CLI_TOOLS = /* @__PURE__ */ new Set([
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
  "obsidian_run_cli",
  "obsidian_read_cli_result"
]);
var RETRIEVAL_ENHANCEMENTS = ["graphify", "smart-connections"];
var OBSIDIAN_TOOL_CAPABILITY_CATALOG = Object.entries(
  OBSIDIAN_ALL_TOOL_OPERATION_MAP
).map(([toolName, operation]) => {
  const name = toolName;
  return {
    toolName: name,
    operation,
    capability: capabilityForOperation(operation),
    requiredPlugins: TOOL_PLUGIN_REQUIREMENTS[name] ?? [],
    requiredRuntimeDependencies: CLI_TOOLS.has(name) ? ["obsidian-cli"] : [],
    enhancedByPlugins: operation.startsWith("retrieval.") ? RETRIEVAL_ENHANCEMENTS : []
  };
});
function evaluateObsidianToolAvailability(descriptor, state) {
  const plugins = new Map(state.plugins.map((plugin) => [plugin.id, plugin]));
  const runtime = new Map(state.runtimeDependencies.map((dependency) => [dependency.id, dependency]));
  const missingPlugins = descriptor.requiredPlugins.filter((id) => plugins.get(id)?.enabled !== true);
  const missingRuntimeDependencies = descriptor.requiredRuntimeDependencies.filter(
    (id) => runtime.get(id)?.available !== true
  );
  const availableEnhancements = descriptor.enhancedByPlugins.filter((id) => plugins.get(id)?.enabled === true);
  const missingEnhancements = descriptor.enhancedByPlugins.filter((id) => plugins.get(id)?.enabled !== true);
  return {
    toolName: descriptor.toolName,
    available: state.capabilities.includes(descriptor.capability) && missingPlugins.length === 0 && missingRuntimeDependencies.length === 0,
    missingPlugins,
    missingRuntimeDependencies,
    availableEnhancements,
    missingEnhancements
  };
}
function capabilityForOperation(operation) {
  if (operation.startsWith("browser.")) return "browser";
  if (operation.startsWith("retrieval.")) return "retrieval";
  if (operation.startsWith("cli.")) return "cli";
  if (operation.startsWith("metadata.") || operation.startsWith("properties.") || operation.startsWith("frontmatter.") || operation.startsWith("tags."))
    return "metadata";
  if (operation.startsWith("links.") || operation.startsWith("graph.")) return "links";
  if (operation.startsWith("tasks.")) return "tasks";
  if (operation.startsWith("attachment.")) return "attachments";
  if (operation.startsWith("editor.")) return "editor";
  if (operation.startsWith("workspace.") || operation.startsWith("app.") || operation === "registry.status")
    return "workspace";
  if (operation.startsWith("commands.")) return "commands";
  if (operation.startsWith("hotkeys.")) return "hotkeys";
  return "vault";
}
export {
  OBSIDIAN_ALL_OPERATIONS,
  OBSIDIAN_ALL_TOOL_NAMES,
  OBSIDIAN_ALL_TOOL_OPERATION_MAP,
  OBSIDIAN_BRIDGE_CAPABILITIES,
  OBSIDIAN_BRIDGE_CAPABILITY_SET,
  OBSIDIAN_BRIDGE_ERROR_CODES,
  OBSIDIAN_BRIDGE_PROTOCOL_VERSION,
  OBSIDIAN_BROWSER_OPERATIONS,
  OBSIDIAN_BROWSER_TOOL_NAMES,
  OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
  OBSIDIAN_CLI_FAMILY_TOOL_NAMES,
  OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP,
  OBSIDIAN_CLI_OPERATIONS,
  OBSIDIAN_CLI_SUBSTRATE_TOOL_NAMES,
  OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP,
  OBSIDIAN_CORE_OPERATIONS,
  OBSIDIAN_DEFAULT_DIRECT_TOOLS,
  OBSIDIAN_DIRECT_TOOL_OPERATION_MAP,
  OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES,
  OBSIDIAN_NON_DIRECT_TOOL_NAMES,
  OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP,
  OBSIDIAN_PLUGIN_NATIVE_OPERATIONS,
  OBSIDIAN_PLUGIN_NATIVE_TOOL_NAMES,
  OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
  OBSIDIAN_RETRIEVAL_OPERATIONS,
  OBSIDIAN_RETRIEVAL_TOOL_NAMES,
  OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP,
  OBSIDIAN_TOOL_CAPABILITY_CATALOG,
  createObsidianMcpServerPolicy,
  evaluateObsidianToolAvailability,
  isBridgeCapability,
  isOperationName,
  parseBridgeErrorPayload,
  parsePluginToServerMessage,
  parseRetrievalEnvelope,
  parseServerToPluginMessage,
  parseVaultSelector
};
