import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import type { FrontendPluginMcpScreenViewModel } from "../../src/vendor/chatobby-client/frontend-plugin-contracts";
import { McpView, type McpViewIntent } from "../../src/features/mcp/ui/mcp-view";
import { mount } from "./helpers/mount";

function editor() {
  const model: FrontendPluginMcpScreenViewModel = {
    screenId: "mcp", revision: 1, loading: false, selectedTab: "installed",
    query: "", configRevision: "one", inventoryRevision: 1,
    servers: [], catalog: [], installedPlugins: [], catalogPlugins: [],
  };
  const onIntent = vi.fn(async (_intent: McpViewIntent) => {});
  const view = new McpView({
    app: { secretStorage: { getSecret: () => null, listSecrets: () => [] } } as unknown as App,
    getModel: () => model, subscribe: () => () => {}, onBack: vi.fn(),
    onRefresh: vi.fn(async () => {}), onNavigatePlugin: vi.fn(), onIntent,
  });
  const element = mount(view);
  element.querySelector<HTMLButtonElement>('[aria-label="Add MCP connection"]')?.click();
  const click = (label: string) => {
    const button = Array.from(element.querySelectorAll("button")).find(b => b.textContent === label);
    if (!button) throw new Error(`Missing ${label}`);
    button.click();
  };
  const input = (key: string) => {
    const control = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-page-state-key="mcp:new:${key}"]`);
    if (!control) throw new Error(`Missing ${key}`);
    return control;
  };
  return { view, element, click, input, onIntent };
}

describe("MCP connection form validation", () => {
  it.each(["Check details", "Save connection"])("%s identifies missing fields without dispatching", (action) => {
    const f = editor();
    f.click(action);
    expect(f.onIntent).not.toHaveBeenCalled();
    expect(f.element.textContent).toContain("Enter a connection name");
    expect(f.element.textContent).toContain("Enter the server address");
    expect(f.input("name").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(f.input("name"));
    f.view.destroy();
  });

  it("preserves the draft while reporting invalid URLs and mapping syntax", () => {
    const f = editor();
    f.input("name").value = "Research tools";
    f.input("url").value = "not a URL";
    f.click("Check details");
    expect(f.onIntent).not.toHaveBeenCalled();
    expect(f.element.textContent).toContain("http:// or https://");
    expect(f.input("name").value).toBe("Research tools");
    f.input("url").value = "https://example.com/mcp";
    f.input("headers").value = "invalid mapping";
    f.click("Check details");
    expect(f.onIntent).not.toHaveBeenCalled();
    expect(f.element.textContent).toContain("NAME=ENV_VARIABLE");
    f.view.destroy();
  });

  it("dispatches a corrected form without enabling tools", () => {
    const f = editor();
    f.click("Check details");
    f.input("name").value = "Research tools";
    f.input("url").value = "http://localhost:6789/mcp";
    f.click("Check details");
    expect(f.onIntent).toHaveBeenCalledOnce();
    expect(f.onIntent).toHaveBeenCalledWith(expect.objectContaining({
      type: "mcp.preview", payload: { draft: expect.objectContaining({ name: "Research tools", enabled: false }) },
    }));
    f.view.destroy();
  });
});
