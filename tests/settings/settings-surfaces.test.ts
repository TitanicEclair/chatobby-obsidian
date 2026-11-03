import { Setting, type App, type SettingGroup } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type ChatobbyPlugin from "../../src/main";
import { ChatobbySettingTab } from "../../src/settings";
import { SettingsScreenController } from "../../src/features/settings/public";
import { FrontendStore } from "../../src/frontend/frontend-store";
import { DEFAULT_PLUGIN_SETTINGS, type PluginSettings, type WsLocalModelProvider, type WsLocalModelProviderDocument, type WsProviderInfo } from "../../src/types";
import { frontendId, type FrontendBootstrap } from "../../src/vendor/chatobby-client/frontend-contracts.js";

/** Actual settings renderer/controller characterization before their owner move.
 * Deferred RPCs distinguish coalescing, host lifetime and revision read points.
 * The late-result case records issue 60's existing limit, not a stale-result fix.
 * Only synthetic credential callbacks run; no credential store or provider runs.
 * @see ../../src/features/settings/README.md
 */
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe("settings surface ownership", () => {
  it("keeps native settings passive and separate embedded renderers independently loaded", async () => {
    const f = fixture();
    f.tab.display();
    expect(f.transport.getProviders).not.toHaveBeenCalled();
    expect(f.plugin.startBackend).not.toHaveBeenCalled();
    expect(headings(f.tab.containerEl)).toEqual(["Runtime", "Documents", "Help and development"]);
    const definition = f.tab.getSettingDefinitions()[0];
    if (!definition || !("type" in definition) || definition.type !== "group") throw new Error("Missing native definition group");
    const entry = definition.items?.[0];
    if (!entry || !("render" in entry) || typeof entry.render !== "function") throw new Error("Missing native renderer");
    const nativeHost = document.body.createDiv();
    entry.render(new Setting(nativeHost), {} as SettingGroup);
    expect(headings(nativeHost)).toEqual(headings(f.tab.containerEl));
    expect(f.transport.getProviders).not.toHaveBeenCalled();

    f.transport.getProviders.mockResolvedValueOnce([provider("first")]).mockResolvedValueOnce([provider("second")]);
    const first = controller(f);
    const second = controller(f);
    first.value.open();
    await vi.waitFor(() => expect(providerNames(first.host)).toContain("first"));
    second.value.open();
    await vi.waitFor(() => expect(providerNames(second.host)).toContain("second"));
    expect(providerNames(first.host)).not.toContain("second");
    expect(f.plugin.startBackend).toHaveBeenCalledTimes(2);
    expect(f.transport.getProviders).toHaveBeenCalledTimes(2);
    expect(headings(first.host)).toEqual(["Model providers", "Web research", "Conversation", "Runtime", "Documents", "Help and development"]);
    f.tab.display();
    expect(f.transport.getProviders).toHaveBeenCalledTimes(2);
    first.value.destroy(); second.value.destroy();
  });

  it("coalesces runtime invalidations until both catalogue reads finish, then refreshes once", async () => {
    const f = fixture();
    const providers = deferred<WsProviderInfo[]>();
    const local = deferred<WsLocalModelProviderDocument>();
    f.transport.getProviders.mockImplementationOnce(() => providers.promise).mockResolvedValue([provider("fresh")]);
    f.transport.getLocalModelProviders.mockImplementationOnce(() => local.promise);
    f.tab.renderChatobbySettings(f.host);
    await vi.waitFor(() => expect(f.transport.getProviders).toHaveBeenCalledOnce());
    f.tab.refreshProviderCatalogFromRuntime(); f.tab.refreshProviderCatalogFromRuntime(); f.tab.refreshProviderCatalogFromRuntime();
    expect(f.transport.getProviders).toHaveBeenCalledOnce();
    providers.resolve([provider("older")]);
    await providers.promise;
    expect(f.host.textContent).toContain("Finding available providers");
    expect(providerNames(f.host)).not.toContain("older");
    local.resolve(documentFor(1));
    await vi.waitFor(() => expect(providerNames(f.host)).toContain("fresh"));
    expect(f.transport.getProviders).toHaveBeenCalledTimes(2);
    expect(f.transport.getLocalModelProviders).toHaveBeenCalledTimes(2);
    expect(f.plugin.startBackend).toHaveBeenCalledOnce();
    expect(f.plugin.createTransport).toHaveBeenCalledOnce();
  });

  it("detaches a closed real controller and stops catalogue subscriptions", async () => {
    const f = fixture(); const pending = deferred<WsProviderInfo[]>();
    f.transport.getProviders.mockImplementationOnce(() => pending.promise);
    const screen = controller(f); screen.value.open();
    await vi.waitFor(() => expect(f.transport.getProviders).toHaveBeenCalledOnce());
    screen.value.close(false);
    pending.resolve([provider("late")]);
    await settle();
    expect(screen.host.childElementCount).toBe(0);
    screen.store.replace(bootstrap(1));
    await settle();
    expect(f.transport.getProviders).toHaveBeenCalledOnce();
    expect(screen.closed).toHaveBeenCalledExactlyOnceWith(false);
    screen.value.destroy();
    expect(screen.closed).toHaveBeenCalledOnce();
  });

  it("characterizes late completion repainting a reopened host, then reads the current transport", async () => {
    const f = fixture(); const pending = deferred<WsProviderInfo[]>();
    f.transport.getProviders.mockImplementationOnce(() => pending.promise);
    const screen = controller(f); screen.value.open();
    await vi.waitFor(() => expect(f.transport.getProviders).toHaveBeenCalledOnce());
    const originalHost = screen.host.querySelector(".chatobby-settings-page__settings");
    screen.value.close(false); screen.value.open();
    const current = transport(); current.getProviders.mockResolvedValue([provider("current")]);
    f.plugin.transport = current;
    pending.resolve([provider("late-original")]);
    await vi.waitFor(() => expect(providerNames(screen.host)).toContain("late-original"));
    expect(originalHost?.isConnected).toBe(false);
    expect(current.getProviders).not.toHaveBeenCalled();
    screen.store.replace(bootstrap(1));
    await vi.waitFor(() => expect(providerNames(screen.host)).toContain("current"));
    expect(providerNames(screen.host)).not.toContain("late-original");
    expect(current.getProviders).toHaveBeenCalledOnce();
    expect(f.plugin.startBackend).toHaveBeenCalledOnce();
    screen.value.destroy();
  });

  it("keeps a failed catalogue pair atomic and retries through the existing start route", async () => {
    const f = fixture(); const local = deferred<WsLocalModelProviderDocument>();
    f.transport.getProviders.mockResolvedValueOnce([provider("partial")]).mockResolvedValue([provider("retried")]);
    f.transport.getLocalModelProviders.mockImplementationOnce(() => local.promise);
    f.tab.renderChatobbySettings(f.host);
    await vi.waitFor(() => expect(f.transport.getLocalModelProviders).toHaveBeenCalledOnce());
    local.reject(new Error("synthetic catalogue failure"));
    await vi.waitFor(() => expect(f.host.textContent).toContain("synthetic catalogue failure"));
    expect(providerNames(f.host)).not.toContain("partial");
    button(f.host, "Try again").click();
    await vi.waitFor(() => expect(providerNames(f.host)).toContain("retried"));
    expect(f.host.textContent).not.toContain("synthetic catalogue failure");
    expect(f.plugin.startBackend).toHaveBeenCalledTimes(2);
  });

  it("preserves runtime/document callbacks and composer shortcut consumption", async () => {
    const f = fixture(); f.plugin.isReleaseBuild.mockReturnValue(false); f.plugin.settings.runtimeMode = "external";
    f.tab.display();
    enter(row(f.tab.containerEl, "External server URL").querySelector<HTMLInputElement>("input"), "  ws://synthetic.invalid:9222  ");
    expect(f.plugin.setExternalServerUrl).toHaveBeenCalledExactlyOnceWith("ws://synthetic.invalid:9222");
    enter(row(f.tab.containerEl, "OCR language").querySelector<HTMLInputElement>("input"), "  ");
    expect(f.plugin.updateSettings).toHaveBeenLastCalledWith({ documentOcrLanguage: "eng" });
    f.tab.renderChatobbySettings(f.host);
    await vi.waitFor(() => expect(f.host.textContent).not.toContain("Finding available providers"));
    const input = row(f.host, "Cancel turn").querySelector<HTMLInputElement>("input")!;
    const bubble = vi.fn(); f.host.addEventListener("keydown", bubble);
    f.plugin.updateSettings.mockClear();
    const duplicate = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
    input.dispatchEvent(duplicate);
    expect(duplicate.defaultPrevented).toBe(true); expect(bubble).not.toHaveBeenCalled();
    expect(f.plugin.updateSettings).not.toHaveBeenCalled();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "F8", bubbles: true, cancelable: true }));
    expect(f.plugin.updateSettings).toHaveBeenLastCalledWith({ composerKeybindings: { ...DEFAULT_PLUGIN_SETTINGS.composerKeybindings, cancelTurn: "F8" } });
    button(row(f.host, "Cancel turn"), "Reset").click();
    await vi.waitFor(() => expect(f.plugin.settings.composerKeybindings.cancelTurn).toBe("Escape"));
  });

  it.each(["provider", "web"] as const)("keeps the %s credential modal and draft through a failed deferred save", async (kind) => {
    const f = fixture(); f.tab.renderChatobbySettings(f.host);
    await vi.waitFor(() => expect(f.host.textContent).toContain("synthetic-provider"));
    const target = row(f.host, kind === "provider" ? "synthetic-provider" : "Enhanced Brave Search");
    button(target, "Connect").click();
    const modal = document.querySelector<HTMLElement>(".chatobby-provider-modal")!;
    const input = modal.querySelector<HTMLInputElement>('input[type="password"]')!;
    enter(input, "  synthetic-value  ");
    const pending = deferred<void>();
    const writer = kind === "provider" ? f.plugin.setProviderKey : f.plugin.setEnhancedWebSearchKey;
    writer.mockImplementationOnce(() => pending.promise);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    button(modal, "Connect").click(); button(modal, "Connect").click();
    expect(writer).toHaveBeenCalledOnce();
    expect(writer.mock.calls[0]).toEqual(kind === "provider" ? ["synthetic-provider", "synthetic-value"] : ["synthetic-value"]);
    expect(button(modal, "Cancel").disabled).toBe(true);
    f.tab.refreshProviderCatalogFromRuntime();
    await vi.waitFor(() => expect(f.transport.getProviders).toHaveBeenCalledTimes(2));
    expect(modal.isConnected).toBe(true); expect(input.value).toBe("  synthetic-value  ");
    pending.reject(new Error("synthetic credential failure"));
    await vi.waitFor(() => expect(button(modal, "Connect").disabled).toBe(false));
    expect(modal.isConnected).toBe(true); expect(input.value).toBe("  synthetic-value  ");
    expect(error).toHaveBeenCalledOnce();
    button(modal, "Cancel").click(); expect(modal.isConnected).toBe(false);
  });

  it("captures local save revision at modal open but delete revision after transport readiness", async () => {
    const f = fixture(); const local = localProvider();
    f.transport.getLocalModelProviders.mockResolvedValue(documentFor(7, [local]));
    f.tab.renderChatobbySettings(f.host);
    await vi.waitFor(() => expect(f.host.textContent).toContain("Local original"));
    button(row(f.host, "Local original"), "Edit").click();
    const modal = document.querySelector<HTMLElement>(".chatobby-local-model-modal")!;
    const saving = deferred<void>(); f.plugin.startBackend.mockImplementationOnce(() => saving.promise);
    button(modal, "Save changes").click();
    f.transport.getLocalModelProviders.mockResolvedValue(documentFor(8, [{ ...local, name: "Local newer" }]));
    f.tab.refreshProviderCatalogFromRuntime();
    await vi.waitFor(() => expect(f.host.textContent).toContain("Local newer"));
    f.transport.getLocalModelProviders.mockResolvedValue(documentFor(9, [local]));
    saving.resolve();
    await vi.waitFor(() => expect(f.transport.saveLocalModelProvider).toHaveBeenCalledExactlyOnceWith(7, local, undefined));
    await vi.waitFor(() => expect(modal.isConnected).toBe(false));
    const deleting = deferred<void>(); f.plugin.startBackend.mockImplementationOnce(() => deleting.promise);
    button(row(f.host, "Local original"), "Remove").click();
    button(document.querySelector<HTMLElement>(".modal")!, "Remove server").click();
    await vi.waitFor(() => expect(f.plugin.startBackend).toHaveBeenCalledTimes(3));
    f.transport.getLocalModelProviders.mockResolvedValue(documentFor(11, [{ ...local, name: "Local latest" }]));
    f.tab.refreshProviderCatalogFromRuntime();
    await vi.waitFor(() => expect(f.host.textContent).toContain("Local latest"));
    f.transport.getLocalModelProviders.mockResolvedValue(documentFor(12));
    deleting.resolve();
    await vi.waitFor(() => expect(f.transport.deleteLocalModelProvider).toHaveBeenCalledExactlyOnceWith(11, local.id, true));
    await vi.waitFor(() => expect(f.host.textContent).not.toContain("Local latest"));
  });
});

function fixture() {
  const rpc = transport();
  const plugin = {
    settings: structuredClone(DEFAULT_PLUGIN_SETTINGS), transport: rpc,
    getRuntimeMode: (): PluginSettings["runtimeMode"] => plugin.settings.runtimeMode,
    getRuntimeState: () => ({ status: "idle" as const }), isReleaseBuild: vi.fn(() => true),
    usesAutomaticRuntimeProvisioning: () => false, startBackend: vi.fn(async () => {}), restartRuntime: vi.fn(async () => {}),
    createTransport: vi.fn((): ReturnType<typeof transport> => plugin.transport), configuredProviders: (): string[] => Object.keys(plugin.settings.providerKeys),
    updateSettings: vi.fn(async (patch: Partial<PluginSettings>): Promise<void> => { Object.assign(plugin.settings, patch); }),
    setProviderKey: vi.fn(async (_provider: string, _key: string) => {}), removeProviderKey: vi.fn(async (_provider: string) => {}),
    hasEnhancedWebSearch: () => false, setEnhancedWebSearchKey: vi.fn(async (_key: string) => {}), removeEnhancedWebSearchKey: vi.fn(async () => {}),
    setExternalServerUrl: vi.fn(async (_url: string) => {}), openChatobbySettings: vi.fn(async () => {}), openRuntimeInstaller: vi.fn(), showWhatsNew: vi.fn(), getActiveView: () => null,
  };
  // This fixture supplies the settings-facing calls; it does not construct a plugin runtime.
  const asPlugin = plugin as unknown as ChatobbyPlugin;
  return { plugin, asPlugin, transport: rpc, tab: new ChatobbySettingTab({} as App, asPlugin), host: document.body.createDiv() };
}

function transport() {
  return {
    isConnected: true, connect: vi.fn(async () => {}),
    getProviders: vi.fn(async (): Promise<WsProviderInfo[]> => [provider("synthetic-provider")]),
    getLocalModelProviders: vi.fn(async (): Promise<WsLocalModelProviderDocument> => documentFor(1)),
    saveLocalModelProvider: vi.fn(async (_revision: number, candidate: WsLocalModelProvider, _key?: string) => documentFor(9, [candidate])),
    deleteLocalModelProvider: vi.fn(async (_revision: number, _id: string, _removeCredential: boolean) => documentFor(12)),
  };
}

function controller(f: ReturnType<typeof fixture>) {
  const host = document.body.createDiv(), store = new FrontendStore(), closed = vi.fn();
  const value = new SettingsScreenController({ app: {} as App, plugin: f.asPlugin, getHost: () => host, getStore: () => store, prepareOpen: vi.fn(), onOpened: vi.fn(), onClosed: closed, downloadGuide: vi.fn() });
  return { value, host, store, closed };
}
function provider(id: string): WsProviderInfo { return { id, name: id, configured: false, modelCount: 1, availableModelCount: 0 }; }
function localProvider(): WsLocalModelProvider {
  return { id: "local-fixture", name: "Local original", preset: "ollama", api: "openai-completions", baseUrl: "http://127.0.0.1:11434/v1", authentication: "none", models: [{ id: "local-model", name: "Local model", contextWindow: 8192, maxTokens: 1024, reasoning: false, imageInput: false }] };
}
function documentFor(revision: number, providers: WsLocalModelProvider[] = []): WsLocalModelProviderDocument { return { schemaVersion: 1, revision, providers, updatedAt: "2026-10-23T00:00:00.000Z", containsSecretValues: false }; }
function row(host: HTMLElement, name: string): HTMLElement {
  const found = Array.from(host.querySelectorAll<HTMLElement>(".setting-item")).find(el => el.querySelector(".setting-item-name")?.textContent === name);
  if (!found) throw new Error(`Missing settings row: ${name}`); return found;
}
function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(host.querySelectorAll("button")).find(el => el.textContent === label);
  if (!found) throw new Error(`Missing button: ${label}`); return found;
}
function enter(input: HTMLInputElement | null, value: string): void { if (!input) throw new Error("Missing input"); input.value = value; input.dispatchEvent(new Event("input")); }
function headings(host: HTMLElement): (string | null)[] { return Array.from(host.querySelectorAll(".setting-item-heading .setting-item-name")).map(el => el.textContent); }
function providerNames(host: HTMLElement): (string | null)[] { return Array.from(host.querySelectorAll(".chatobby-settings__provider .setting-item-name")).map(el => el.textContent); }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
async function settle(): Promise<void> { await new Promise(resolve => setTimeout(resolve, 0)); }
function bootstrap(revision: number): FrontendBootstrap {
  return { schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: frontendId("runtime", "runtimeInstanceId"), revision, sequence: revision, viewId: frontendId("view", "viewId"), session: null, taskPlan: { revision: 0, completedCount: 0, remainingCount: 0, summary: "No tracked tasks", items: [] }, composer: { canSubmit: true, controls: [] }, agentRail: { items: [] }, feed: { revision: 0, blocks: [] }, screens: [], screenModels: [], localCommands: [] };
}
