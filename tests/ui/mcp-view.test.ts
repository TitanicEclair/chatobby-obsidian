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
    sourcePath: "C:/vault/.chatobby/mcp.json",
    writable: true,
    transport: "remote",
    lifecycle: "lazy",
    toolCount: 0,
    resourceCount: 0,
    tools: [],
    resources: [],
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

  it("links an explicitly selected Obsidian secret for bearer-authenticated plugins", async () => {
    const bearerApp = {
      secretStorage: {
        getSecret: (reference: string) => reference === "github-token" ? "test-token" : null,
        listSecrets: () => ["github-token"],
      },
    } as unknown as App;
    const bearerServer = {
      ...server(),
      enabled: true,
      state: "needs-sign-in" as const,
      authentication: "bearer" as const,
      requiresAuthentication: true,
    };
    const selected = {
      ...detail(),
      enabled: true,
      state: "needs-sign-in" as const,
      server: bearerServer,
    };
    const current = model({
      servers: [bearerServer],
      selectedPluginId: selected.id,
      selectedPlugin: selected,
    });
    const onIntent = vi.fn(async (_intent: McpViewIntent) => {});
    const view = new McpView({
      app: bearerApp,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onNavigatePlugin: vi.fn(),
      initialPluginId: selected.id,
    });
    const element = mount(view);

    expect(element.textContent).toContain("The token stays in Obsidian");
    expect(element.textContent).toContain("No access token is linked.");
    expect(element.textContent).not.toContain("Sign in");
    const connect = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Connect");
    expect(connect?.disabled).toBe(true);
    expect(connect?.title).toContain("Link an access token");
    const secret = element.querySelector<HTMLSelectElement>(
      "[data-page-state-key='mcp:demo:credential']",
    );
    expect(secret?.value).toBe("");
    const link = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Link selected token");
    expect(link?.disabled).toBe(true);

    if (!secret || !link) return;
    secret.value = "github-token";
    secret.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(link.disabled).toBe(false);
    expect(onIntent).not.toHaveBeenCalled();
    link.click();

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

  it("adds a Chatobby-verified plugin disabled only after its detail page is reviewed", async () => {
    const catalog = {
      name: "github",
      title: "GitHub",
      description: "Work with repositories, issues, pull requests, and workflows.",
      version: "1.7.0",
      repositoryUrl: "https://github.com/github/github-mcp-server",
      transportLabel: "Remote",
      environmentNames: [],
      canConfigure: true,
    };
    const selected: FrontendChatobbyPluginDetail = {
      id: "mcp:verified:github",
      title: catalog.title,
      description: catalog.description,
      version: catalog.version,
      publisher: "GitHub",
      source: "first-party",
      sourceLabel: "Verified by Chatobby",
      verifiedPublisher: true,
      brandIcon: "github",
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
      cautions: ["Review the token scopes before enabling write-capable tools."],
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

    expect(element.querySelector("[data-brand-icon='github']")).not.toBeNull();
    expect(element.querySelector("[aria-label='Verified by Chatobby']")).not.toBeNull();
    const add = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Add disabled");
    expect(add).toBeDefined();
    add?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.configure-verified",
        payload: {
          expectedConfigRevision: "config-1",
          pluginId: "github",
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

  it("shows the complete release-owned verified catalogue without registry pagination", () => {
    const catalogPlugins = Array.from({ length: 25 }, (_, index): FrontendChatobbyPluginSummary => ({
      ...installedPlugin(),
      id: `mcp:verified:plugin-${index}`,
      title: `Verified plugin ${String(index + 1).padStart(2, "0")}`,
      source: "first-party",
      sourceLabel: "Verified by Chatobby",
      verifiedPublisher: true,
      installed: false,
      state: "available",
    }));
    const current = model({
      selectedTab: "discover",
      servers: [],
      installedPlugins: [],
      catalogPlugins,
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

    expect(element.querySelectorAll(".chatobby-mcp__plugin-row")).toHaveLength(25);
    expect(element.textContent).toContain("25 shown");
    expect(element.textContent).toContain("25 verified plugins in this Chatobby release");
    expect(element.textContent).not.toContain("Load more");
    expect(element.textContent).not.toContain("MCP Registry");
  });

  it("explains a connection filter miss without implying an unavailable external catalogue", () => {
    const verifiedPlugin: FrontendChatobbyPluginSummary = {
      ...installedPlugin(),
      id: "mcp:verified:github",
      title: "GitHub",
      source: "first-party",
      sourceLabel: "Verified by Chatobby",
      verifiedPublisher: true,
      installed: false,
      state: "available",
    };
    const current = model({
      selectedTab: "discover",
      servers: [],
      installedPlugins: [],
      catalogPlugins: [verifiedPlugin],
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
    const connection = element.querySelector<HTMLSelectElement>("[aria-label='Filter by connection']");
    expect(connection).not.toBeNull();
    if (!connection) return;

    connection.value = "local";
    connection.dispatchEvent(new window.Event("change", { bubbles: true, cancelable: true }));

    expect(element.textContent).toContain("No matching verified plugins");
    expect(element.textContent).toContain("different connection filter");
    expect(element.textContent).not.toContain("Registry");
  });

  it("labels the page as Connections and Verified without registry language", () => {
    const verified = {
      ...installedPlugin(),
      id: "mcp:verified:github",
      title: "GitHub",
      source: "first-party" as const,
      sourceLabel: "Verified by Chatobby",
      verifiedPublisher: true,
      installed: false,
      state: "available" as const,
    };
    const current = model({
      selectedTab: "discover",
      catalogPlugins: [verified],
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

    expect(element.textContent).toContain("Connections");
    expect(element.textContent).toContain("Verified");
    expect(element.textContent).toContain("GitHub");
    expect(element.textContent).not.toContain("Registry");
  });

  it("guides users from connection type to relevant details without exposing advanced fields first", () => {
    const current = model({ selectedTab: "installed", servers: [], installedPlugins: [] });
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
    element.querySelector<HTMLButtonElement>("[aria-label='Add MCP connection']")?.click();

    expect(element.textContent).toContain("What would you like to connect?");
    expect(element.textContent).toContain("Connections give Chatobby new tools");
    expect(element.textContent).toContain("Browse Verified");
    const remote = [...element.querySelectorAll<HTMLButtonElement>(".chatobby-mcp__connection-choice")]
      .find((button) => button.textContent?.includes("Online service"));
    const local = [...element.querySelectorAll<HTMLButtonElement>(".chatobby-mcp__connection-choice")]
      .find((button) => button.textContent?.includes("Program on this computer"));
    expect(remote?.getAttribute("aria-pressed")).toBe("true");
    expect(element.querySelector(".chatobby-mcp__remote-fields")?.classList.contains("is-hidden")).toBe(false);
    expect(element.querySelector(".chatobby-mcp__local-fields")?.classList.contains("is-hidden")).toBe(true);
    expect(element.querySelector(".chatobby-mcp__advanced")?.hasAttribute("open")).toBe(false);
    expect(element.textContent).toContain("Save connection");
    expect(element.textContent).toContain("Test connection");

    local?.click();

    expect(local?.getAttribute("aria-pressed")).toBe("true");
    expect(remote?.getAttribute("aria-pressed")).toBe("false");
    expect(element.querySelector(".chatobby-mcp__remote-fields")?.classList.contains("is-hidden")).toBe(true);
    expect(element.querySelector(".chatobby-mcp__local-fields")?.classList.contains("is-hidden")).toBe(false);
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
