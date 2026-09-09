import { describe, expect, it, vi } from "vitest";
import { ChatobbySettingTab } from "../src/settings";
import type ChatobbyPlugin from "../src/main";
import type { WsProviderInfo } from "../src/types";

describe("ChatobbySettingTab", () => {
  it("discovers providers automatically and shows connected providers first", async () => {
    const providers: WsProviderInfo[] = [
      {
        id: "openai",
        name: "OpenAI",
        configured: false,
        modelCount: 4,
        availableModelCount: 0,
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        configured: true,
        authSource: "stored",
        modelCount: 2,
        availableModelCount: 2,
        modelDiscovery: {
          checkedAt: 1,
          error: "Model discovery returned HTTP 503.",
          usingCachedModels: true,
          unavailableModels: [{ id: "restricted-model", reason: "Disabled by account policy." }],
        },
      },
    ];
    const transport = {
      isConnected: true,
      getProviders: vi.fn(async () => providers),
      getLocalModelProviders: vi.fn(async () => ({
        schemaVersion: 1 as const,
        revision: 1,
        providers: [
          {
            id: "local-qwen",
            name: "llama.cpp on this computer",
            preset: "llama-cpp" as const,
            api: "openai-completions" as const,
            baseUrl: "http://127.0.0.1:8080/v1",
            authentication: "none" as const,
            models: [
              {
                id: "qwen3",
                name: "Qwen 3",
                contextWindow: 32_768,
                maxTokens: 4_096,
                reasoning: true,
                imageInput: false,
              },
            ],
          },
        ],
        updatedAt: "2026-08-08T00:00:00.000Z",
        containsSecretValues: false as const,
      })),
    };
    const plugin = {
      settings: {
        runtimeAutoStart: true,
        runtimeLifetime: "obsidian-session",
        thinkingDisplay: "collapsed",
        autoScroll: true,
        composerKeybindings: {
          previousMessage: "ArrowUp",
          nextMessage: "ArrowDown",
          stashDraft: "Mod+S",
          restoreStash: "Mod+Shift+S",
          cancelTurn: "Escape",
        },
        autoNameStrategy: "truncate",
        externalServerUrl: "",
        developerCommand: "chatobby",
        developerArgs: [],
        providerKeys: { deepseek: true },
        onboardingVersion: 0,
      },
      transport,
      getRuntimeMode: () => "managed",
      getRuntimeState: () => ({
        status: "ready",
        runtime: {
          identity: { runtimeVersion: "0.1.0" },
          ownership: "managed",
        },
      }),
      isReleaseBuild: () => true,
      usesAutomaticRuntimeProvisioning: () => false,
      startBackend: vi.fn(async () => {}),
      restartRuntime: vi.fn(async () => {}),
      createTransport: () => transport,
      configuredProviders: () => ["deepseek"],
      updateSettings: vi.fn(async () => {}),
      setProviderKey: vi.fn(async () => {}),
      removeProviderKey: vi.fn(async () => {}),
      hasEnhancedWebSearch: () => false,
      setEnhancedWebSearchKey: vi.fn(async () => {}),
      removeEnhancedWebSearchKey: vi.fn(async () => {}),
      openChatobbySettings: vi.fn(async () => {}),
    } as unknown as ChatobbyPlugin;
    const tab = new ChatobbySettingTab({} as never, plugin);

    expect(tab.getSettingDefinitions()).toMatchObject([
      {
        type: "group",
        items: [
          {
            name: "Chatobby settings",
            aliases: expect.arrayContaining([
              "install runtime",
              "API key",
              "auto-scroll",
              "composer shortcuts",
            ]),
            render: expect.any(Function),
          },
        ],
      },
    ]);

    tab.display();

    expect(tab.containerEl.textContent).toContain(
      "Everyday Chatobby settings moved into Chatobby",
    );
    expect(tab.containerEl.textContent).toContain("Open Chatobby Settings");
    expect(tab.containerEl.textContent).not.toContain(
      "Finding available providers",
    );
    expect(tab.containerEl.textContent).not.toContain("Get runtime");
    expect(tab.containerEl.textContent).toContain("Support development");
    expect(tab.containerEl.textContent).toContain("Patreon");
    expect(tab.containerEl.textContent).toContain("Automatic uses Windows PowerShell on Windows");
    expect(tab.containerEl.textContent).not.toContain("Automatic uses Git Bash");

    const embedded = document.body.createDiv();
    tab.renderChatobbySettings(embedded);
    expect(embedded.textContent).not.toContain("review the Project access mode");
    expect(embedded.textContent).toContain("What’s new");
    expect(embedded.textContent).not.toContain("active permission profile");
    expect(embedded.textContent).toContain("Finding available providers");
    await vi.waitFor(() =>
      expect(transport.getProviders).toHaveBeenCalledOnce(),
    );
    await vi.waitFor(() =>
      expect(transport.getLocalModelProviders).toHaveBeenCalledOnce(),
    );
    await vi.waitFor(() => expect(embedded.textContent).toContain("OpenAI"));
    expect(embedded.textContent).toContain("llama.cpp on this computer");
    expect(embedded.textContent).toContain("HTTP 503");
    expect(embedded.textContent).toContain("Keeping the last account model list");
    const modelDetails = embedded.querySelector<HTMLDetailsElement>(".chatobby-settings__model-discovery");
    expect(modelDetails?.open).toBe(false);
    expect(modelDetails?.textContent).toContain("restricted-model");
    expect(modelDetails?.textContent).toContain("Disabled by account policy.");
    expect(embedded.textContent).toContain("Local model connections");
    expect(embedded.textContent).toContain(
      "Connect Ollama, LM Studio or another model server",
    );
    expect(embedded.textContent).not.toContain("Managed llama.cpp");
    expect(embedded.textContent).toContain("Web research");
    expect(embedded.textContent).toContain("Enhanced Brave Search");
    expect(embedded.textContent).toContain("Basic public-web search");
    expect(embedded.textContent).toContain("Support development");
    expect(embedded.textContent).toContain("Patreon");
    expect(plugin.startBackend).toHaveBeenCalledOnce();
    expect(embedded.textContent).not.toContain("Load providers");
    const names = Array.from(
      embedded.querySelectorAll(
        ".chatobby-settings__provider .setting-item-name",
      ),
    ).map((element) => element.textContent);
    expect(names).toEqual([
      "llama.cpp on this computer",
      "DeepSeek (deepseek)",
      "OpenAI (openai)",
      "Enhanced Brave Search",
    ]);

    transport.getProviders.mockResolvedValueOnce([
      ...providers,
      {
        id: "mistral",
        name: "Mistral",
        configured: false,
        modelCount: 1,
        availableModelCount: 0,
      },
    ]);
    tab.refreshProviderCatalogFromRuntime();
    await vi.waitFor(() => expect(transport.getProviders).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(embedded.textContent).toContain("Mistral"));

    (
      tab as unknown as { openLocalProviderModal: () => void }
    ).openLocalProviderModal();
    const modelServerModal = document.querySelector<HTMLElement>(
      ".chatobby-local-model-modal",
    );
    expect(modelServerModal?.textContent).toContain("Connect a model server");
    expect(modelServerModal?.querySelector<HTMLSelectElement>('[aria-label="Model connection kind"]')?.value).toBe("local");
    expect(modelServerModal?.querySelector<HTMLDetailsElement>(".chatobby-local-model-modal__advanced")?.open).toBe(false);

    tab.refreshProviderCatalogFromRuntime();
    await vi.waitFor(() => expect(transport.getProviders).toHaveBeenCalledTimes(3));
    expect(modelServerModal?.isConnected).toBe(true);
    modelServerModal?.remove();

    const legacy = (await transport.getLocalModelProviders()).providers[0];
    (tab as unknown as { openLocalProviderModal: (provider: typeof legacy) => void }).openLocalProviderModal(legacy);
    const legacyModal = document.querySelector<HTMLElement>(".chatobby-local-model-modal");
    const kind = legacyModal?.querySelector<HTMLSelectElement>('[aria-label="Model connection kind"]');
    expect(kind?.value).toBe("");
    expect(Array.from(kind?.options ?? []).map((option) => option.value)).toEqual(["", "local", "hosted"]);
    legacyModal?.remove();

    transport.getLocalModelProviders.mockResolvedValueOnce({
      ...(await transport.getLocalModelProviders()), providers: [],
    });
    tab.refreshProviderCatalogFromRuntime();
    await vi.waitFor(() => expect(embedded.textContent).toContain("Connect server to find its models"));
    expect(embedded.textContent).not.toContain("exact model ID here");

    tab.detachChatobbySettings(embedded);
    embedded.remove();
  });
});
