import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import type {
  FrontendChatobbyPluginDetail,
  FrontendChatobbyPluginSummary,
  FrontendPluginMcpScreenViewModel,
} from "../../src/vendor/chatobby-client/frontend-plugin-contracts.js";
import type { FrontendMcpServerViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { McpView, type McpViewIntent } from "../../src/features/mcp/ui/mcp-view";
import { renderPluginBrandIcon } from "../../src/features/mcp/ui/plugin-brand-icon";
import { mount } from "./helpers/mount";

const counts = {
  mcpServers: 1,
  skills: 0,
  commands: 0,
  workflows: 0,
  contextQueries: 0,
} as const;
const app = {
  secretStorage: {
    getSecret: () => null,
    listSecrets: () => [],
  },
} as unknown as App;

function server(): FrontendMcpServerViewModel {
  return {
    id: "demo",
    state: "disabled",
    enabled: false,
    builtIn: false,
    sourceLabel: "project Chatobby configuration",
    sourceScope: "project",
    writable: true,
    transport: "remote",
    lifecycle: "lazy",
    toolCount: 0,
    resourceCount: 0,
    requiresAuthentication: false,
    authentication: "none",
    arguments: [],
    url: "https://example.com/mcp",
    environmentNames: ["DEMO_TOKEN"],
    headerNames: [],
  };
}

function installedPlugin(): FrontendChatobbyPluginSummary {
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

function model(
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

function detail(): FrontendChatobbyPluginDetail {
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
    permissions: ["Connected tools remain subject to the active Chatobby permission policy."],
    cautions: [],
    metrics: [],
    server: server(),
  };
}

describe("McpView", () => {
  it("renders a minimal plugin list and routes a plugin selection through Obsidian history", () => {
    const current = model();
    const onNavigatePlugin = vi.fn();
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent: vi.fn(async (_intent: McpViewIntent) => {}),
      onNavigatePlugin,
    });
    const element = mount(view);

    expect(element.matches(".chatobby-mcp.chatobby-page")).toBe(true);
    expect(element.textContent).toContain("Plugins");
    expect(element.textContent).toContain("Demo plugin");
    expect(element.textContent).not.toContain("DEMO_TOKEN");

    element.querySelector<HTMLButtonElement>(".chatobby-mcp__plugin-row")?.click();
    expect(onNavigatePlugin).toHaveBeenCalledWith("mcp:installed:demo");
  });

  it("shows a manifest-rendered plugin page without exposing private skill content", () => {
    const current = model({
      selectedPluginId: "mcp:installed:demo",
      selectedPlugin: detail(),
    });
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent: vi.fn(async (_intent: McpViewIntent) => {}),
      onNavigatePlugin: vi.fn(),
      initialPluginId: "mcp:installed:demo",
    });
    const element = mount(view);

    expect(element.textContent).toContain("Demo plugin");
    expect(element.textContent).toContain("Capabilities");
    expect(element.textContent).toContain("Project skill");
    expect(element.textContent).toContain("A user-managed project skill.");
    expect(element.textContent).not.toContain("SKILL.md");
    expect(element.textContent).not.toContain("DEMO_TOKEN");
  });

  it("uses Obsidian SecretStorage selection for bearer-authenticated plugins", async () => {
    const bearerServer = {
      ...server(),
      authentication: "bearer" as const,
      requiresAuthentication: true,
    };
    const selected = {
      ...detail(),
      server: bearerServer,
    };
    const current = model({
      servers: [bearerServer],
      selectedPluginId: selected.id,
      selectedPlugin: selected,
    });
    const onIntent = vi.fn(async (_intent: McpViewIntent) => {});
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onNavigatePlugin: vi.fn(),
      initialPluginId: selected.id,
    });
    const element = mount(view);

    expect(element.textContent).toContain("Choose a secret stored by Obsidian.");
    expect(element.textContent).not.toContain("Sign in");
    const secret = element.querySelector<HTMLSelectElement>(".secret-component");
    expect(secret).not.toBeNull();
    if (!secret) return;
    secret.createEl("option", { value: "github-token", text: "github-token" });
    secret.value = "github-token";
    secret.dispatchEvent(new window.Event("change", { bubbles: true }));

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.set-credential-reference",
        payload: {
          expectedConfigRevision: "config-1",
          serverId: "demo",
          reference: "github-token",
          scope: "project",
        },
      }),
    );
  });

  it("adds a registry plugin disabled only after its detail page is reviewed", async () => {
    const catalog = {
      name: "com.notion/mcp",
      title: "Notion",
      description: "Public registry description.",
      version: "1.2.3",
      repositoryUrl: "https://github.com/example/demo",
      transportLabel: "Remote",
      environmentNames: [],
      canConfigure: true,
    };
    const selected: FrontendChatobbyPluginDetail = {
      id: "mcp:registry:com.notion%2Fmcp",
      title: catalog.title,
      description: catalog.description,
      version: catalog.version,
      publisher: "Notion",
      source: "community",
      sourceLabel: "Official MCP Registry",
      verifiedPublisher: true,
      brandIcon: "notion",
      installed: false,
      enabled: false,
      state: "available",
      transport: "remote",
      transportLabel: "Remote",
      repositoryUrl: catalog.repositoryUrl,
      capabilityCounts: counts,
      canConfigure: true,
      capabilities: [{
        kind: "mcp-server",
        id: catalog.name,
        title: catalog.title,
        description: catalog.description,
      }],
      setup: [],
      permissions: ["Review the server before enabling it."],
      cautions: ["Registry publication is not a Chatobby endorsement."],
      metrics: [],
      catalog,
    };
    const current = model({
      selectedTab: "discover",
      servers: [],
      installedPlugins: [],
      selectedPluginId: selected.id,
      selectedPlugin: selected,
    });
    const onIntent = vi.fn(async (_intent: McpViewIntent) => {});
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onNavigatePlugin: vi.fn(),
      initialPluginId: selected.id,
    });
    const element = mount(view);

    expect(element.querySelector("[data-brand-icon='notion']")).not.toBeNull();
    expect(element.querySelector("[aria-label='Verified publisher']")).not.toBeNull();
    const add = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Add disabled");
    expect(add).toBeDefined();
    add?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.configure-registry",
        payload: {
          expectedConfigRevision: "config-1",
          registryName: "com.notion/mcp",
          registryVersion: "1.2.3",
          scope: "project",
        },
      }),
    );
  });

  it("renders locally bundled productivity brand marks", () => {
    for (const brandIcon of [
      "google",
      "gmail",
      "google-drive",
      "google-sheets",
      "google-slides",
      "google-calendar",
      "microsoft",
      "slack",
      "dropbox",
      "box",
      "canva",
      "airtable",
      "postman",
    ] as const) {
      const parent = document.createElement("span");
      renderPluginBrandIcon(parent, brandIcon);
      expect(parent.dataset.brandIcon).toBe(brandIcon);
      expect(parent.querySelector("svg")).not.toBeNull();
    }

    const microsoft = document.createElement("span");
    renderPluginBrandIcon(microsoft, "microsoft");
    expect(microsoft.querySelectorAll("rect")).toHaveLength(4);
  });

  it("paginates sorted visible results before expanding the registry index", async () => {
    const catalogPlugins = Array.from({ length: 25 }, (_, index): FrontendChatobbyPluginSummary => ({
      ...installedPlugin(),
      id: `mcp:registry:community-${index}`,
      title: `Community plugin ${String(index + 1).padStart(2, "0")}`,
      source: "community",
      sourceLabel: "MCP Registry",
      installed: false,
      state: "available",
    }));
    const current = model({
      selectedTab: "discover",
      servers: [],
      installedPlugins: [],
      catalogPlugins,
      nextCatalogCursor: "next-page",
    });
    const onIntent = vi.fn(async (_intent: McpViewIntent) => {});
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onNavigatePlugin: vi.fn(),
    });
    const element = mount(view);

    expect(element.querySelectorAll(".chatobby-mcp__plugin-row")).toHaveLength(20);
    expect(element.textContent).toContain("20 of 25 shown");
    expect(element.textContent).toContain("25 catalogue entries indexed");

    const showMore = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Show 5 more");
    expect(showMore).toBeDefined();
    showMore?.click();

    expect(element.querySelectorAll(".chatobby-mcp__plugin-row")).toHaveLength(25);
    expect(element.textContent).toContain("25 shown");
    const findMore = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Find more plugins");
    expect(findMore).toBeDefined();
    findMore?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.set-view",
        payload: {
          tab: "discover",
          query: "",
          cursor: "next-page",
        },
      }),
    );
  });

  it("explains a filter miss without claiming the loaded catalogue is unavailable", () => {
    const communityPlugin: FrontendChatobbyPluginSummary = {
      ...installedPlugin(),
      id: "mcp:registry:community",
      title: "Community plugin",
      source: "community",
      sourceLabel: "MCP Registry",
      installed: false,
      state: "available",
    };
    const current = model({
      selectedTab: "discover",
      servers: [],
      installedPlugins: [],
      catalogPlugins: [communityPlugin],
      nextCatalogCursor: "next-page",
    });
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent: vi.fn(async (_intent: McpViewIntent) => {}),
      onNavigatePlugin: vi.fn(),
    });
    const element = mount(view);
    const source = element.querySelector<HTMLSelectElement>("[aria-label='Filter by source']");
    expect(source).not.toBeNull();
    if (!source) return;

    source.value = "first-party";
    expect(source.value).toBe("first-party");
    source.dispatchEvent(new window.Event("change", { bubbles: true, cancelable: true }));

    expect(element.textContent).toContain("No matching plugins");
    expect(element.textContent).toContain("Change the source or connection filter.");
    expect(element.textContent).not.toContain("Refresh when the MCP Registry is available.");
    expect(element.textContent).not.toContain("Find more plugins");
  });

  it("keeps local plugins visible when the public catalogue is temporarily unavailable", () => {
    const featured = {
      ...installedPlugin(),
      id: "mcp:registry:featured",
      title: "Featured plugin",
      installed: false,
      state: "available" as const,
    };
    const current = model({
      selectedTab: "discover",
      catalogError: "Official MCP Registry request timed out.",
      catalogPlugins: [featured],
    });
    const onRefresh = vi.fn(async () => {});
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh,
      onIntent: vi.fn(async (_intent: McpViewIntent) => {}),
      onNavigatePlugin: vi.fn(),
    });
    const element = mount(view);

    expect(element.textContent).toContain("public plugin catalogue is temporarily unavailable");
    expect(element.textContent).toContain("Featured plugin");
    const retry = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Try again");
    retry?.click();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows and invokes cancellation while an MCP connection is starting", async () => {
    const connectingServer = { ...server(), enabled: true, state: "connecting" as const };
    const selected = {
      ...detail(),
      enabled: true,
      state: "connecting" as const,
      server: connectingServer,
    };
    const current = model({
      servers: [connectingServer],
      selectedPluginId: selected.id,
      selectedPlugin: selected,
    });
    const onIntent = vi.fn(async (_intent: McpViewIntent) => {});
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onNavigatePlugin: vi.fn(),
      initialPluginId: selected.id,
    });
    const element = mount(view);

    expect(element.textContent).toContain("Connecting…");
    const cancel = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Cancel connection");
    cancel?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.disconnect",
        payload: { serverId: "demo" },
      }),
    );
  });
});
