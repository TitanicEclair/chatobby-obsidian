// Synthetic runtime projections shared by MCP view/controller lifecycle tests.
// @see ../../../docs/api/mcp.md
import type { FrontendMcpServerViewModel } from "../../../src/vendor/chatobby-client/frontend-contracts.js";
import type { FrontendChatobbyPluginDetail, FrontendChatobbyPluginSummary, FrontendPluginMcpScreenViewModel } from "../../../src/vendor/chatobby-client/frontend-plugin-contracts.js";

export const counts = {
  mcpServers: 1,
  skills: 0,
  commands: 0,
  workflows: 0,
  contextQueries: 0,
} as const;
export function server(
  overrides: Partial<FrontendMcpServerViewModel> = {},
): FrontendMcpServerViewModel {
  return {
    id: "demo",
    state: "disabled",
    enabled: false,
    builtIn: false,
    sourceLabel: "Chatobby user MCP configuration",
    sourceScope: "global",
    sourcePath: "C:/Users/demo/.chatobby/mcp.json",
    writable: true,
    transport: "remote",
    lifecycle: "lazy",
    toolCount: 0,
    enabledToolCount: 0,
    toolReviewRequired: false,
    resourceCount: 0,
    tools: [],
    resources: [],
    requiresAuthentication: false,
    authentication: "none",
    arguments: [],
    url: "https://example.com/mcp",
    environmentNames: ["DEMO_TOKEN"],
    headerNames: [],
    ...overrides,
  };
}

export function installedPlugin(): FrontendChatobbyPluginSummary {
  return {
    id: "mcp:installed:demo",
    title: "Demo plugin",
    description: "Adds the Demo MCP server.",
    publisher: "Custom",
    source: "custom",
    sourceLabel: "Custom",
    verifiedPublisher: false,
    installed: true,
    enabled: false,
    state: "disabled",
    transport: "remote",
    transportLabel: "Remote",
    capabilityCounts: counts,
    canConfigure: true,
  };
}

export function model(
  overrides: Partial<FrontendPluginMcpScreenViewModel> = {},
): FrontendPluginMcpScreenViewModel {
  return {
    screenId: "mcp",
    revision: 1,
    loading: false,
    selectedTab: "installed",
    query: "",
    configRevision: "config-1",
    inventoryRevision: 1,
    servers: [server()],
    catalog: [],
    installedPlugins: [installedPlugin()],
    catalogPlugins: [],
    ...overrides,
  };
}

export function detail(): FrontendChatobbyPluginDetail {
  return {
    ...installedPlugin(),
    capabilities: [
      {
        kind: "mcp-server",
        id: "demo",
        title: "Demo server",
        description: "Provides two connected tools.",
      },
      {
        kind: "skill",
        id: "project-skill",
        title: "Project skill",
        description: "A user-managed project skill.",
      },
    ],
    setup: [{ label: "Connection", value: "https://example.com/mcp" }],
    permissions: [
      "Connected tools remain subject to the active Chatobby permission policy.",
    ],
    cautions: [],
    metrics: [],
    server: server(),
  };
}
