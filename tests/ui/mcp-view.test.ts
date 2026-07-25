import { describe, expect, it, vi } from "vitest";
import type { FrontendMcpScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { McpView, type McpViewIntent } from "../../src/features/mcp/ui/mcp-view";
import { mount } from "./helpers/mount";

function model(): FrontendMcpScreenViewModel {
  return {
    screenId: "mcp",
    revision: 1,
    loading: false,
    selectedTab: "installed",
    query: "",
    configRevision: "config-1",
    inventoryRevision: 1,
    servers: [
      {
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
        arguments: [],
        url: "https://example.com/mcp",
        environmentNames: ["DEMO_TOKEN"],
        headerNames: [],
      },
    ],
    catalog: [],
  };
}

describe("McpView", () => {
  it("renders a minimal installed-server row and sends revisioned enable actions", async () => {
    const current = model();
    const onIntent = vi.fn(async (_intent: McpViewIntent) => {});
    const view = new McpView({
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent,
    });
    const element = mount(view);

    expect(element.matches(".chatobby-mcp.chatobby-page")).toBe(true);
    expect(element.textContent).toContain("demo");
    expect(element.textContent).toContain("Disabled");
    expect(element.textContent).not.toContain("DEMO_TOKEN");

    element.querySelector<HTMLButtonElement>(".chatobby-mcp__toggle")?.click();
    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.set-enabled",
        payload: {
          expectedConfigRevision: "config-1",
          serverId: "demo",
          enabled: true,
          scope: "project",
        },
      }),
    );
  });

  it("keeps registry entries disabled until the user reviews them", async () => {
    const current: FrontendMcpScreenViewModel = {
      ...model(),
      selectedTab: "discover",
      catalog: [
        {
          name: "io.example/demo",
          title: "Demo server",
          description: "Public registry description.",
          version: "1.2.3",
          repositoryUrl: "https://github.com/example/demo",
          transportLabel: "Remote",
          environmentNames: [],
          canConfigure: true,
        },
      ],
    };
    const onIntent = vi.fn(async (_intent: McpViewIntent) => {});
    const view = new McpView({
      getModel: () => current,
      subscribe: () => () => {},
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onIntent,
    });
    const element = mount(view);
    expect(element.textContent).toContain(
      "Registry entries are added disabled so you can review them before any process starts.",
    );
    const add = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "Add");
    add?.click();

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "mcp.configure-registry",
        payload: {
          expectedConfigRevision: "config-1",
          registryName: "io.example/demo",
          registryVersion: "1.2.3",
          scope: "project",
        },
      }),
    );
  });
});
