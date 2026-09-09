import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import type {
  FrontendChatobbyPluginDetail,
  FrontendChatobbyPluginSummary,
  FrontendPluginMcpScreenViewModel,
} from "../../src/vendor/chatobby-client/frontend-plugin-contracts.js";
import type { FrontendMcpServerViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import {
  McpView,
  type McpViewIntent,
} from "../../src/features/mcp/ui/mcp-view";
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

function server(
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
    permissions: [
      "Connected tools remain subject to the active Chatobby permission policy.",
    ],
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

    element
      .querySelector<HTMLButtonElement>(".chatobby-mcp__plugin-row")
      ?.click();
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

  it("tests a disabled remote server without enabling agent access", async () => {
    const selected = detail();
    const current = model({
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

    expect(element.textContent).toContain("can affect the remote service");
    expect(element.textContent).toContain("never turns on agent access");
    const discover = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Test & discover");
    expect(discover?.disabled).toBe(false);
    discover?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.discover",
        payload: { serverId: "demo" },
      }),
    );
  });

  it("renders exact per-tool exposure independently from connection and sandbox scope", async () => {
    const discovered = server({
      toolCount: 2,
      enabledToolCount: 1,
      toolReviewRequired: true,
      tools: [
        {
          name: "search",
          title: "Search",
          description: "Search records",
          enabled: true,
        },
        {
          name: "delete",
          title: "Delete",
          description: "Delete a record",
          enabled: false,
        },
      ],
      resourceCount: 1,
      resources: [
        {
          uri: "demo://status",
          name: "Status",
          toolName: "get_status",
          enabled: false,
        },
      ],
    });
    const selected = { ...detail(), server: discovered };
    const current = model({
      servers: [discovered],
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

    expect(element.textContent).toContain("1 exposed · 2 tools · 1 resource");
    expect(element.textContent).toContain(
      "older connection used implicit access",
    );
    expect(element.textContent).toContain(
      "does not change the agent's access mode",
    );
    expect(element.textContent).toContain(
      "grant project, vault, filesystem, shell, or network access",
    );
    const search = element.querySelector<HTMLInputElement>(
      "[aria-label='Expose tool Search to agents']",
    );
    const remove = element.querySelector<HTMLInputElement>(
      "[aria-label='Expose tool Delete to agents']",
    );
    const resource = element.querySelector<HTMLInputElement>(
      "[aria-label='Expose resource Status to agents']",
    );
    expect(search?.checked).toBe(true);
    expect(remove?.checked).toBe(false);
    expect(resource?.checked).toBe(false);
    remove?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.set-tool-enabled",
        payload: {
          expectedConfigRevision: "config-1",
          serverId: "demo",
          toolName: "delete",
          enabled: true,
          scope: "user",
        },
      }),
    );
  });

  it("keeps unavailable local executable connections fail-closed with the runtime reason", () => {
    const local = server({
      state: "configured",
      enabled: true,
      transport: "local",
      url: undefined,
      command: "demo-mcp",
      arguments: ["serve"],
      localExecution: {
        status: "unavailable",
        reason:
          "Local MCP programs are unavailable until native process containment is verified.",
      },
    });
    const selected = { ...detail(), server: local };
    const current = model({
      servers: [local],
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
    const discover = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Test & discover");
    const connect = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Connect");

    expect(discover?.disabled).toBe(true);
    expect(connect?.disabled).toBe(true);
    expect(element.textContent).toContain(
      "Local MCP programs are unavailable until native process containment is verified.",
    );
    discover?.click();
    connect?.click();
    expect(onIntent).not.toHaveBeenCalled();
  });

  it("allows an admitted local executable test with an explicit unsandboxed warning", async () => {
    const local = server({
      transport: "local",
      url: undefined,
      command: "demo-mcp",
      arguments: ["serve"],
      localExecution: { status: "available", mode: "unsandboxed" },
    });
    const selected = { ...detail(), server: local };
    const current = model({
      servers: [local],
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
    const discover = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Test & discover");

    expect(discover?.disabled).toBe(false);
    expect(element.textContent).toContain(
      "unsandboxed as your user account",
    );
    discover?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.discover",
        payload: { serverId: "demo" },
      }),
    );
  });

  it("shows the same admitted-execution boundary for built-in local servers", () => {
    const builtIn = server({
      id: "chatobby-web",
      builtIn: true,
      writable: false,
      transport: "local",
      url: undefined,
      command: "chatobby-runtime",
      localExecution: {
        status: "unavailable",
        reason:
          "Built-in web and Obsidian tools are unavailable while native containment is unverified.",
      },
    });
    const selected = { ...detail(), server: builtIn };
    const current = model({
      servers: [builtIn],
      selectedPluginId: selected.id,
      selectedPlugin: selected,
    });
    const view = new McpView({
      app,
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent: vi.fn(async (_intent: McpViewIntent) => {}),
      onNavigatePlugin: vi.fn(),
      initialPluginId: selected.id,
    });
    const element = mount(view);

    expect(element.textContent).toContain(
      "Built-in web and Obsidian tools are unavailable while native containment is unverified.",
    );
    expect(element.textContent).not.toContain(
      "Review and add this suggestion",
    );
  });

  it("links an explicitly selected Obsidian secret for bearer-authenticated plugins", async () => {
    const bearerApp = {
      secretStorage: {
        getSecret: (reference: string) =>
          reference === "github-token" ? "test-token" : null,
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
    const connect = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Connect");
    expect(connect?.disabled).toBe(true);
    expect(connect?.title).toContain("Link an access token");
    const secret = element.querySelector<HTMLSelectElement>(
      "[data-page-state-key='mcp:demo:credential']",
    );
    expect(secret?.value).toBe("");
    const link = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Link selected token");
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
          scope: "user",
        },
      }),
    );
  });

  it("adds a Chatobby-verified plugin disabled only after its detail page is reviewed", async () => {
    const catalog = {
      name: "github",
      title: "GitHub",
      description:
        "Work with repositories, issues, pull requests, and workflows.",
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
      capabilities: [
        {
          kind: "mcp-server",
          id: catalog.name,
          title: catalog.title,
          description: catalog.description,
        },
      ],
      setup: [],
      permissions: ["Review the server before enabling it."],
      cautions: [
        "Review the token scopes before enabling write-capable tools.",
      ],
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
    expect(
      element.querySelector("[aria-label='Verified by Chatobby']"),
    ).not.toBeNull();
    const add = [...element.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Add disabled",
    );
    expect(add).toBeDefined();
    add?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.configure-verified",
        payload: {
          expectedConfigRevision: "config-1",
          pluginId: "github",
          scope: "user",
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
    const catalogPlugins = Array.from(
      { length: 25 },
      (_, index): FrontendChatobbyPluginSummary => ({
        ...installedPlugin(),
        id: `mcp:verified:plugin-${index}`,
        title: `Verified plugin ${String(index + 1).padStart(2, "0")}`,
        source: "first-party",
        sourceLabel: "Verified by Chatobby",
        verifiedPublisher: true,
        installed: false,
        state: "available",
      }),
    );
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

    expect(element.querySelectorAll(".chatobby-mcp__plugin-row")).toHaveLength(
      25,
    );
    expect(element.textContent).toContain("25 shown");
    expect(element.textContent).toContain(
      "25 verified plugins in this Chatobby release",
    );
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
    const connection = element.querySelector<HTMLSelectElement>(
      "[aria-label='Filter by connection']",
    );
    expect(connection).not.toBeNull();
    if (!connection) return;

    connection.value = "local";
    connection.dispatchEvent(
      new window.Event("change", { bubbles: true, cancelable: true }),
    );

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

  it("distinguishes form validation from a real saved-server connection", async () => {
    const current = model({
      selectedTab: "installed",
      servers: [],
      installedPlugins: [],
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
    element
      .querySelector<HTMLButtonElement>("[aria-label='Add MCP connection']")
      ?.click();

    expect(element.textContent).toContain("What would you like to connect?");
    expect(element.textContent).toContain(
      "Connections give Chatobby new tools",
    );
    expect(element.textContent).toContain("Browse Verified");
    const remote = [
      ...element.querySelectorAll<HTMLButtonElement>(
        ".chatobby-mcp__connection-choice",
      ),
    ].find((button) => button.textContent?.includes("Online service"));
    const local = [
      ...element.querySelectorAll<HTMLButtonElement>(
        ".chatobby-mcp__connection-choice",
      ),
    ].find((button) =>
      button.textContent?.includes("Program on this computer"),
    );
    expect(remote?.getAttribute("aria-pressed")).toBe("true");
    expect(
      element
        .querySelector(".chatobby-mcp__remote-fields")
        ?.classList.contains("is-hidden"),
    ).toBe(false);
    expect(
      element
        .querySelector(".chatobby-mcp__local-fields")
        ?.classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      element.querySelector(".chatobby-mcp__advanced")?.hasAttribute("open"),
    ).toBe(false);
    expect(element.textContent).toContain("Save connection");
    expect(element.textContent).toContain("Check details");
    expect(element.textContent).toContain("does not contact or start the server");

    local?.click();

    expect(local?.getAttribute("aria-pressed")).toBe("true");
    expect(remote?.getAttribute("aria-pressed")).toBe("false");
    expect(
      element
        .querySelector(".chatobby-mcp__remote-fields")
        ?.classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      element
        .querySelector(".chatobby-mcp__local-fields")
        ?.classList.contains("is-hidden"),
    ).toBe(false);

    const nameInput = element.querySelector<HTMLInputElement>("[data-page-state-key='mcp:new:name']")!;
    const commandInput = element.querySelector<HTMLInputElement>("[data-page-state-key='mcp:new:command']")!;
    nameInput.value = "demo";
    commandInput.value = "demo-mcp";

    [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Check details")
      ?.click();
    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "mcp.preview" }),
      ),
    );
  });

  it("reviews a project suggestion into a separate disabled user-owned connection", async () => {
    const suggestion = server({
      id: "project-demo",
      sourceLabel: "project MCP discovery",
      sourceScope: "project",
      sourcePath: "C:/vault/.chatobby/mcp.json",
      writable: false,
      transport: "local",
      command: "project-mcp",
      arguments: ["serve", "--project"],
      workingDirectory: "C:/vault",
      url: undefined,
      authentication: "none",
      enabled: false,
      enabledToolCount: 0,
      tools: [{ name: "project_tool", title: "Project tool", enabled: false }],
      toolCount: 1,
    });
    const selected = { ...detail(), server: suggestion };
    const current = model({
      servers: [suggestion],
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

    expect(element.textContent).toContain("Review & add");
    expect(
      element.querySelector<HTMLInputElement>(
        "[aria-label='Expose tool Project tool to agents']",
      )?.disabled,
    ).toBe(true);
    [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Review & add")
      ?.click();

    expect(element.textContent).toContain("Project suggestion");
    expect(element.textContent).toContain("The project file remains unchanged");
    expect(element.textContent).not.toContain("Where should it be available?");
    expect(
      element.querySelector<HTMLInputElement>(
        "[data-page-state-key='mcp:new:name']",
      )?.value,
    ).toBe("project-demo");
    expect(
      element.querySelector<HTMLInputElement>(
        "[data-page-state-key='mcp:new:command']",
      )?.value,
    ).toBe("project-mcp");
    expect(
      element.querySelector<HTMLTextAreaElement>(
        "[data-page-state-key='mcp:new:arguments']",
      )?.value,
    ).toBe("serve\n--project");

    [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Save connection")
      ?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.save",
        payload: {
          expectedConfigRevision: "config-1",
          draft: expect.objectContaining({
            name: "project-demo",
            scope: "user",
            enabled: false,
            lifecycle: "lazy",
            transport: "local",
            command: "project-mcp",
            arguments: ["serve", "--project"],
            environment: [],
            headers: [],
          }),
        },
      }),
    );
  });

  it("does not contact or authenticate an unreviewed remote project suggestion", () => {
    const suggestion = server({
      id: "project-remote",
      sourceLabel: "project MCP discovery",
      sourceScope: "project",
      sourcePath: "C:/vault/.mcp.json",
      writable: false,
      transport: "remote",
      url: "https://project.example/mcp",
      authentication: "oauth",
      requiresAuthentication: true,
      enabled: false,
      tools: [],
      toolCount: 0,
    });
    const selected = { ...detail(), server: suggestion };
    const current = model({
      servers: [suggestion],
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
    const discover = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Test & discover");

    expect(element.textContent).toContain("Review & add");
    expect(element.textContent).toContain(
      "Review and add this suggestion before Chatobby contacts it",
    );
    expect(discover?.disabled).toBe(true);
    expect(discover?.title).toContain("before contacting it");
    expect(element.textContent).not.toContain("Sign in");
    discover?.click();
    expect(onIntent).not.toHaveBeenCalled();
  });

  it("shows and invokes cancellation while an MCP connection is starting", async () => {
    const connectingServer = {
      ...server(),
      enabled: true,
      state: "connecting" as const,
    };
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
    const cancel = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Cancel connection");
    cancel?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.disconnect",
        payload: { serverId: "demo" },
      }),
    );
  });

  it("stops an isolated Test & discover operation", async () => {
    const discoveringServer = server({ state: "discovering" });
    const selected = {
      ...detail(),
      state: "discovering" as const,
      server: discoveringServer,
    };
    const current = model({
      servers: [discoveringServer],
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

    expect(element.textContent).toContain("Testing connection…");
    const stop = [
      ...element.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Stop test");
    stop?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.disconnect",
        payload: { serverId: "demo" },
      }),
    );
  });
});
