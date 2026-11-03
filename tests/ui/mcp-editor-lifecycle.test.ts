import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpView, type McpViewIntent } from "../../src/features/mcp/ui/mcp-view";
import type { FrontendPluginMcpScreenViewModel } from "../../src/vendor/chatobby-client/frontend-plugin-contracts";
import { mount } from "./helpers/mount";
import { detail, server } from "../support/mcp/screen";

// Real view + PageShell composition: draft restoration must also restore derived UI.
// @see ../../docs/api/mcp.md
const views: McpView[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function fixture() {
  let model: FrontendPluginMcpScreenViewModel = {
    screenId: "mcp", revision: 1, loading: false, selectedTab: "installed",
    query: "", configRevision: "config-1", inventoryRevision: 1,
    servers: [], catalog: [], installedPlugins: [], catalogPlugins: [],
  };
  let listener: ((model: FrontendPluginMcpScreenViewModel | null) => void) | undefined;
  const secrets = ["synthetic-token"];
  const getSecret = vi.fn(() => "synthetic-private-value");
  const onIntent = vi.fn<(intent: McpViewIntent) => Promise<void>>(async () => {});
  const unsubscribe = vi.fn();
  const view = new McpView({
    app: { secretStorage: { getSecret, listSecrets: () => [...secrets] } } as unknown as App,
    getModel: () => model, subscribe: (next) => { listener = next; return unsubscribe; },
    onBack: vi.fn(), onRefresh: vi.fn(async () => {}), onNavigatePlugin: vi.fn(), onIntent,
  });
  views.push(view);
  const element = mount(view);
  const click = (text: string) => {
    const button = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find((candidate) => candidate.textContent?.trim() === text);
    if (!button) throw new Error(`Missing synthetic editor action: ${text}`);
    button.click();
  };
  const field = (key: string) => {
    const control = element.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[data-page-state-key="mcp:new:${key}"]`,
    );
    if (!control) throw new Error(`Missing synthetic editor field: ${key}`);
    return control;
  };
  const set = (key: string, value: string) => {
    const control = field(key);
    control.value = value;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const open = () => element.querySelector<HTMLButtonElement>('[aria-label="Add MCP connection"]')!.click();
  open();
  return {
    view, element, click, field, set, open, secrets, getSecret, onIntent, unsubscribe,
    publish: (overrides: Partial<FrontendPluginMcpScreenViewModel> = {}) => {
      model = { ...model, revision: model.revision + 1, configRevision: "config-2", ...overrides };
      listener?.(model);
    },
  };
}

describe("MCP editor lifetime", () => {
  it("restores local draft presentation, focus, selection, disclosure and scroll after a model update", () => {
    const f = fixture();
    f.set("transport", "local");
    f.set("name", "Synthetic local");
    f.set("command", "synthetic-mcp");
    f.set("arguments", "serve\n--synthetic");
    const command = f.field("command") as HTMLInputElement;
    command.focus();
    command.setSelectionRange(2, 7);
    // Model native CSS-hidden focus refusal; Happy DOM otherwise focuses hidden controls.
    const nativeFocus = HTMLInputElement.prototype.focus;
    vi.spyOn(HTMLInputElement.prototype, "focus").mockImplementation(function (this: HTMLInputElement, options?: FocusOptions) {
      if (!this.closest(".is-hidden")) nativeFocus.call(this, options);
    });
    f.element.querySelector<HTMLDetailsElement>(".chatobby-mcp__advanced")!.open = true;
    f.element.querySelector<HTMLElement>(".chatobby-page__body")!.scrollTop = 57;

    f.publish();

    expect(f.field("transport").value).toBe("local");
    expect(f.field("arguments").value).toBe("serve\n--synthetic");
    expect(f.element.querySelector(".chatobby-mcp__local-fields")?.classList.contains("is-hidden")).toBe(false);
    expect(f.element.querySelector(".chatobby-mcp__remote-fields")?.classList.contains("is-hidden")).toBe(true);
    expect([...f.element.querySelectorAll(".chatobby-mcp__connection-choice")]
      .map((choice) => choice.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
    expect(document.activeElement).toBe(f.field("command"));
    expect((f.field("command") as HTMLInputElement).selectionStart).toBe(2);
    expect((f.field("command") as HTMLInputElement).selectionEnd).toBe(7);
    expect(f.element.querySelector<HTMLDetailsElement>(".chatobby-mcp__advanced")?.open).toBe(true);
    expect(f.element.querySelector<HTMLElement>(".chatobby-page__body")?.scrollTop).toBe(57);
    expect(f.onIntent).not.toHaveBeenCalled();
  });

  it("keeps a bearer draft visible after rejected preview without reading or dispatching a secret value", async () => {
    const f = fixture();
    f.set("name", "Synthetic remote");
    f.set("url", "https://example.invalid/mcp");
    f.set("auth", "bearer");
    f.set("credential", "synthetic-token");
    f.onIntent.mockRejectedValueOnce(new Error("Synthetic preview rejected"));
    f.click("Check details");
    await vi.waitFor(() => expect(f.element.textContent).toContain("Synthetic preview rejected"));

    expect(f.field("auth").value).toBe("bearer");
    expect(f.field("credential").value).toBe("synthetic-token");
    expect(f.field("credential").closest(".chatobby-mcp__secret-field")?.classList.contains("is-hidden")).toBe(false);
    expect(f.field("name").value).toBe("Synthetic remote");
    expect(f.onIntent).toHaveBeenCalledOnce();
    expect(f.onIntent).toHaveBeenCalledWith({ type: "mcp.preview", payload: { draft: expect.objectContaining({
      scope: "user", enabled: false, authentication: "bearer", bearerCredentialReference: "synthetic-token",
    }) } });
    expect(f.getSecret).not.toHaveBeenCalled();
    expect(JSON.stringify(f.onIntent.mock.calls)).not.toContain("synthetic-private-value");
  });

  it("preserves rejected saves and uses the latest displayed config revision on a successful retry", async () => {
    const f = fixture();
    f.set("name", "Synthetic remote");
    f.set("url", "https://example.invalid/mcp");
    f.onIntent.mockRejectedValueOnce(new Error("Synthetic revision conflict"));
    f.click("Save connection");
    await vi.waitFor(() => expect(f.element.textContent).toContain("Synthetic revision conflict"));
    expect(f.field("name").value).toBe("Synthetic remote");
    f.publish();
    f.click("Save connection");
    await vi.waitFor(() => expect(f.element.querySelector(".chatobby-mcp__editor")).toBeNull());
    expect(f.onIntent).toHaveBeenLastCalledWith({ type: "mcp.save", payload: {
      expectedConfigRevision: "config-2", draft: expect.objectContaining({ enabled: false, scope: "user" }),
    } });
  });

  it("does not let completion of a cancelled editor's save close a newly opened draft", async () => {
    const f = fixture();
    let complete!: () => void;
    f.onIntent.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    f.set("name", "Old synthetic draft");
    f.set("url", "https://example.invalid/old");
    f.click("Save connection");
    expect(f.onIntent).toHaveBeenCalledOnce();
    f.click("Cancel");
    f.open();
    f.set("name", "New synthetic draft");
    f.set("url", "https://example.invalid/new");
    complete();
    await vi.waitFor(() => expect(f.element.querySelector(".chatobby-page__body")?.getAttribute("aria-busy")).toBe("false"));
    expect(f.field("name").value).toBe("New synthetic draft");
    expect(f.onIntent).toHaveBeenCalledOnce();
  });

  it("does not show an old editor's rejection on a newly opened draft", async () => {
    const f = fixture();
    let reject!: (error: Error) => void;
    f.onIntent.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    f.set("name", "Old synthetic draft");
    f.set("url", "https://example.invalid/old");
    f.click("Save connection");
    f.click("Cancel");
    f.open();
    f.set("name", "New synthetic draft");
    reject(new Error("Previous editor rejected"));
    await vi.waitFor(() => expect(f.element.querySelector(".chatobby-page__body")?.getAttribute("aria-busy")).toBe("false"));
    expect(f.field("name").value).toBe("New synthetic draft");
    expect(f.element.textContent).not.toContain("Previous editor rejected");
    expect(f.onIntent).toHaveBeenCalledOnce();
  });

  it("refreshes secret names without linking them, preserving valid selection and clearing removed names", () => {
    const f = fixture();
    f.set("auth", "bearer");
    f.set("credential", "synthetic-token");
    f.secrets.push("another-synthetic-token");
    f.click("Refresh saved tokens");
    expect(f.field("credential").value).toBe("synthetic-token");
    f.secrets.splice(f.secrets.indexOf("synthetic-token"), 1);
    f.click("Refresh saved tokens");
    expect(f.field("credential").value).toBe("");
    expect(f.getSecret).not.toHaveBeenCalled();
    expect(f.onIntent).not.toHaveBeenCalled();
  });

  it("validates and submits mappings only for the chosen transport", async () => {
    const f = fixture();
    f.set("name", "Synthetic local");
    f.set("transport", "local");
    f.set("command", "synthetic-mcp");
    f.set("environment", "TOKEN=SYNTHETIC_TOKEN");
    f.set("headers", "not a valid mapping");
    f.click("Check details");
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledOnce());
    expect(f.onIntent).toHaveBeenLastCalledWith({ type: "mcp.preview", payload: { draft: expect.objectContaining({
      environment: [{ name: "TOKEN", sourceEnvironmentVariable: "SYNTHETIC_TOKEN" }], headers: [],
    }) } });
    await Promise.resolve();
    f.set("transport", "remote");
    f.set("url", "http://localhost:12345/mcp");
    f.set("headers", "X-Token=SYNTHETIC_TOKEN");
    f.set("environment", "not a valid mapping");
    f.click("Check details");
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledTimes(2));
    expect(f.onIntent).toHaveBeenLastCalledWith({ type: "mcp.preview", payload: { draft: expect.objectContaining({
      environment: [], headers: [{ name: "X-Token", sourceEnvironmentVariable: "SYNTHETIC_TOKEN" }],
    }) } });
  });

  it("closes via Escape without dispatch and disposes the model subscription", () => {
    const f = fixture();
    f.set("name", "Discarded synthetic draft");
    expect(f.view.handleKeydown(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
    expect(f.element.querySelector(".chatobby-mcp__editor")).toBeNull();
    f.open();
    expect(f.field("name").value).toBe("");
    expect(f.onIntent).not.toHaveBeenCalled();
    f.view.destroy();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });

  it("does not transfer one Project suggestion's draft into another route", () => {
    const f = fixture();
    f.click("Cancel");
    const suggestion = (id: string) => ({
      ...detail(), id: `suggestion:${id}`,
      server: server({ id, writable: false, sourceScope: "project", transport: "local",
        command: `${id}-mcp`, url: undefined, authentication: "none" }),
    });
    const first = suggestion("first");
    f.publish({ selectedPlugin: first, selectedPluginId: first.id });
    f.view.setPluginRoute(first.id);
    f.click("Review & add");
    f.set("name", "Edited first suggestion");
    f.set("command", "edited-first-mcp");

    const second = suggestion("second");
    f.view.setPluginRoute(second.id);
    f.publish({ selectedPlugin: second, selectedPluginId: second.id });
    f.click("Review & add");
    expect(f.field("name").value).toBe("second");
    expect(f.field("command").value).toBe("second-mcp");
    expect(f.field("credential").value).toBe("");
    expect(f.onIntent).not.toHaveBeenCalled();
  });

  it("recomputes token-link availability after a model update without linking automatically", () => {
    const f = fixture();
    f.click("Cancel");
    const selected = { ...detail(), server: server({ authentication: "bearer" }) };
    f.publish({ selectedPlugin: selected, selectedPluginId: selected.id });
    f.view.setPluginRoute(selected.id);
    const token = () => f.element.querySelector<HTMLSelectElement>('[data-page-state-key="mcp:demo:credential"]')!;
    token().value = "synthetic-token";
    token().dispatchEvent(new Event("change", { bubbles: true }));
    f.publish();
    expect(token().value).toBe("synthetic-token");
    const link = [...f.element.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Link selected token");
    expect(link?.disabled).toBe(false);
    expect(f.onIntent).not.toHaveBeenCalled();
    f.click("Link selected token");
    expect(f.onIntent).toHaveBeenCalledWith({ type: "mcp.set-credential-reference", payload: {
      expectedConfigRevision: "config-2", serverId: "demo", reference: "synthetic-token", scope: "user",
    } });
  });

  it("does not render a detached form when a save completes after view disposal", async () => {
    const f = fixture();
    let complete!: () => void;
    f.onIntent.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    f.set("name", "Disposed synthetic draft");
    f.set("url", "https://example.invalid/mcp");
    f.click("Save connection");
    f.view.destroy();
    const markup = f.element.innerHTML;
    complete();
    await Promise.resolve();
    expect(f.element.isConnected).toBe(false);
    expect(f.element.innerHTML).toBe(markup);
    expect(f.onIntent).toHaveBeenCalledOnce();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });

  it("does not steal focus from an overlay opened during field restoration", () => {
    const f = fixture();
    f.field("name").focus();
    const overlay = document.body.createEl("input");
    f.element.addEventListener("focusin", () => overlay.focus());
    f.publish();
    expect(document.activeElement).toBe(overlay);
    expect(f.onIntent).not.toHaveBeenCalled();
  });
});
