import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpView, type McpViewIntent } from "../../src/features/mcp/ui/mcp-view";
import type { FrontendChatobbyPluginDetail, FrontendPluginMcpScreenViewModel } from "../../src/vendor/chatobby-client/frontend-plugin-contracts";
import { detail, installedPlugin, model, server } from "../support/mcp/screen";
import { mount } from "./helpers/mount";

// Exercise the real view, PageShell and extracted renderers together. These tests
// protect navigation and callback ownership, not a second rendering implementation.
// @see ../../docs/api/mcp.md
const views: McpView[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function fixture(initial = model()) {
  let current = initial;
  let listener: ((next: FrontendPluginMcpScreenViewModel | null) => void) | undefined;
  const onIntent = vi.fn<(intent: McpViewIntent) => Promise<void>>(async () => {});
  const unsubscribe = vi.fn();
  const onNavigatePlugin = vi.fn();
  const getSecret = vi.fn(() => "synthetic-private-value");
  const view = new McpView({
    app: { secretStorage: { listSecrets: () => ["synthetic-token"], getSecret } } as unknown as App,
    getModel: () => current,
    subscribe: (next) => { listener = next; return unsubscribe; },
    onBack: vi.fn(), onRefresh: vi.fn(async () => {}), onIntent, onNavigatePlugin,
    initialPluginId: initial.selectedPluginId,
  });
  views.push(view);
  const element = mount(view);
  const field = (key: string) => {
    const control = element.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-page-state-key="${key}"]`);
    if (!control) throw new Error(`Missing synthetic MCP field: ${key}`);
    return control;
  };
  const change = (key: string, value: string, event = "change") => {
    const control = field(key);
    control.value = value;
    control.dispatchEvent(new Event(event, { bubbles: true }));
  };
  const click = (text: string) => {
    const button = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((candidate) => candidate.textContent?.trim() === text || candidate.getAttribute("aria-label") === text);
    if (!button) throw new Error(`Missing synthetic MCP action: ${text}`);
    button.click();
  };
  const publish = (update: Partial<FrontendPluginMcpScreenViewModel>) => {
    current = { ...current, revision: current.revision + 1, ...update };
    listener?.(current);
  };
  return {
    view, element, field, change, click, publish, onIntent, onNavigatePlugin, unsubscribe, getSecret,
    titles: () => [...element.querySelectorAll(".chatobby-mcp__plugin-title")].map((row) => row.textContent),
    route: (selected?: FrontendChatobbyPluginDetail) => {
      view.setPluginRoute(selected?.id);
      publish({ selectedPluginId: selected?.id, selectedPlugin: selected });
    },
  };
}

describe("MCP catalogue and detail lifetime", () => {
  it("keeps local filters, sort, search focus and caret across a fresh runtime projection", () => {
    const base = installedPlugin();
    const plugins = [
      { ...base, id: "zeta", title: "Zeta records" },
      { ...base, id: "alpha", title: "Alpha records" },
      { ...base, id: "local", title: "Local records", transport: "local" as const },
      { ...base, id: "other", title: "Other", description: "Other capabilities" },
    ];
    const f = fixture(model({ installedPlugins: plugins }));
    f.change("plugins:installed:query", "records", "input");
    f.change("plugins:connection", "remote");
    f.change("plugins:sort", "name");
    const search = f.field("plugins:installed:query") as HTMLInputElement;
    search.focus();
    search.setSelectionRange(1, 4);
    f.publish({ installedPlugins: [...plugins, { ...base, id: "beta", title: "Beta records" }] });

    expect(f.titles()).toEqual(["Alpha records", "Beta records", "Zeta records"]);
    expect(f.element.querySelector(".chatobby-mcp__result-count")?.textContent).toBe("3 matches");
    expect(f.field("plugins:connection").value).toBe("remote");
    expect(f.field("plugins:sort").value).toBe("name");
    expect(document.activeElement).toBe(f.field("plugins:installed:query"));
    expect((f.field("plugins:installed:query") as HTMLInputElement).selectionStart).toBe(1);
    expect((f.field("plugins:installed:query") as HTMLInputElement).selectionEnd).toBe(4);
    expect(f.onIntent).not.toHaveBeenCalled();
  });

  it("routes list selections and Back without dispatching runtime mutations, restoring the list scroll and filters", () => {
    const f = fixture();
    f.change("plugins:installed:query", "Demo", "input");
    f.change("plugins:connection", "remote");
    f.change("plugins:sort", "name");
    f.element.querySelector<HTMLElement>(".chatobby-page__body")!.scrollTop = 73;
    f.click("Open Demo plugin");
    expect(f.onNavigatePlugin).toHaveBeenLastCalledWith(detail().id);
    f.route(detail());
    expect(f.element.querySelector(".chatobby-mcp__plugin-overview")).not.toBeNull();
    f.click("Back to plugins");
    expect(f.onNavigatePlugin).toHaveBeenLastCalledWith();
    f.route();
    expect(f.field("plugins:installed:query").value).toBe("Demo");
    expect(f.field("plugins:connection").value).toBe("remote");
    expect(f.field("plugins:sort").value).toBe("name");
    expect(f.element.querySelector<HTMLElement>(".chatobby-page__body")?.scrollTop).toBe(73);
    expect(f.titles()).toEqual(["Demo plugin"]);
    expect(f.onIntent).not.toHaveBeenCalled();
  });

  it("coalesces verified search and flushes Enter once without a delayed duplicate", async () => {
    vi.useFakeTimers();
    const f = fixture(model({ selectedTab: "discover" }));
    f.change("plugins:discover:query", " old ", "input");
    await vi.advanceTimersByTimeAsync(200);
    f.change("plugins:discover:query", " latest ", "input");
    await vi.advanceTimersByTimeAsync(299);
    expect(f.onIntent).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.onIntent).toHaveBeenCalledExactlyOnceWith({ type: "mcp.set-view", payload: { tab: "discover", query: "latest", cursor: undefined } });
    f.publish({ query: "latest" });
    f.change("plugins:discover:query", " entered ", "input");
    f.field("plugins:discover:query").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
    expect(f.onIntent).toHaveBeenCalledTimes(2);
    expect(f.onIntent).toHaveBeenLastCalledWith({ type: "mcp.set-view", payload: { tab: "discover", query: "entered", cursor: undefined } });
  });

  it("disposes the search timer and subscription when the actual view closes", async () => {
    vi.useFakeTimers();
    const f = fixture(model({ selectedTab: "discover" }));
    f.change("plugins:discover:query", "queued", "input");
    f.view.destroy();
    f.publish({ query: "late snapshot" });
    await vi.advanceTimersByTimeAsync(500);
    expect(f.unsubscribe).toHaveBeenCalledOnce();
    expect(f.onIntent).not.toHaveBeenCalled();
    expect(document.querySelector(".chatobby-mcp")).toBeNull();
  });

  it("requires confirmation for removal, clears it on another route, and dispatches the latest displayed revision", async () => {
    const selected = detail();
    const f = fixture(model({ selectedPluginId: selected.id, selectedPlugin: selected }));
    f.click("Remove");
    expect(f.element.querySelector(".chatobby-mcp__confirm")).not.toBeNull();
    expect(f.onIntent).not.toHaveBeenCalled();
    f.click("Cancel");
    expect(f.element.querySelector(".chatobby-mcp__confirm")).toBeNull();
    f.click("Remove");
    f.route({ ...selected, id: "other", title: "Other plugin", server: server({ id: "other" }) });
    expect(f.element.querySelector(".chatobby-mcp__confirm")).toBeNull();
    f.route(selected);
    f.click("Remove");
    f.publish({ configRevision: "config-new" });
    f.click("Remove plugin");
    await vi.waitFor(() => expect(f.onNavigatePlugin).toHaveBeenCalledOnce());
    expect(f.onIntent).toHaveBeenCalledExactlyOnceWith({ type: "mcp.remove", payload: { serverId: "demo", expectedConfigRevision: "config-new", scope: "user" } });
  });

  it("does not expose stale detail actions while another plugin projection is loading", () => {
    const selected = detail();
    const f = fixture(model({ selectedPluginId: selected.id, selectedPlugin: selected }));
    f.view.setPluginRoute("other");
    expect(f.element.textContent).toContain("Opening plugin");
    expect(f.element.querySelector(".chatobby-mcp__server-actions")).toBeNull();
    expect(f.onIntent).not.toHaveBeenCalled();
    f.publish({ selectedPluginId: "other", selectedPlugin: { ...selected, id: "other", server: server({ id: "other" }) } });
    f.click("Diagnostics");
    expect(f.onIntent).toHaveBeenCalledExactlyOnceWith({ type: "mcp.diagnostics", payload: { serverId: "other" } });
  });

  it("keeps OAuth input through updates and submits only the explicit trimmed response", () => {
    const f = fixture(model({ pendingAuthentication: { serverId: "demo", authorizationUrl: "https://example.invalid/auth" } }));
    f.change("mcp:auth:demo", " synthetic-code ");
    f.publish({ inventoryRevision: 2 });
    expect(f.field("mcp:auth:demo").value).toBe(" synthetic-code ");
    expect(f.onIntent).not.toHaveBeenCalled();
    f.click("Complete sign-in");
    expect(f.onIntent).toHaveBeenCalledExactlyOnceWith({ type: "mcp.auth-complete", payload: { serverId: "demo", input: "synthetic-code" } });
    expect(f.getSecret).not.toHaveBeenCalled();
  });

  it.each(["https://example.invalid/source", "http://example.invalid/source"])("renders admitted external links consistently: %s", (url) => {
    const selected: FrontendChatobbyPluginDetail = { ...detail(), repositoryUrl: url, metrics: [{ id: "npm-downloads", label: "Uses", value: 12, period: "Monthly", sourceUrl: url }] };
    const f = fixture(model({ selectedPluginId: selected.id, selectedPlugin: selected, pendingAuthentication: { serverId: "demo", authorizationUrl: url } }));
    const links = [...f.element.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.href).toBe(url);
      expect(link.target).toBe("_blank");
      expect(link.rel).toBe("noopener noreferrer");
    }
    expect(f.onIntent).not.toHaveBeenCalled();
    expect(f.getSecret).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "data:text/html,synthetic"])("omits unsafe external links while retaining metric text: %s", (url) => {
    const selected: FrontendChatobbyPluginDetail = { ...detail(), repositoryUrl: url, metrics: [{ id: "npm-downloads", label: "Uses", value: 12, period: "Monthly", sourceUrl: url }] };
    const f = fixture(model({ selectedPluginId: selected.id, selectedPlugin: selected, pendingAuthentication: { serverId: "demo", authorizationUrl: url } }));
    expect(f.element.querySelectorAll("a")).toHaveLength(0);
    expect(f.element.querySelector(".chatobby-mcp__metric-value")?.textContent).toBe("12");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
});
