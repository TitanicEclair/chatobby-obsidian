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
      },
    ];
    const transport = { isConnected: true, getProviders: vi.fn(async () => providers) };
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
      },
      transport,
      getRuntimeMode: () => "managed",
      getRuntimeState: () => ({
        status: "ready",
        runtime: { identity: { runtimeVersion: "0.1.0" }, ownership: "managed" },
      }),
      isReleaseBuild: () => true,
      startBackend: vi.fn(async () => {}),
      restartRuntime: vi.fn(async () => {}),
      createTransport: () => transport,
      configuredProviders: () => ["deepseek"],
      updateSettings: vi.fn(async () => {}),
      setProviderKey: vi.fn(async () => {}),
      removeProviderKey: vi.fn(async () => {}),
    } as unknown as ChatobbyPlugin;
    const tab = new ChatobbySettingTab({} as never, plugin);

    expect(tab.getSettingDefinitions()).toMatchObject([{ type: "group", items: [{
      name: "Chatobby settings",
      aliases: expect.arrayContaining(["install runtime", "API key", "auto-scroll", "composer shortcuts"]),
      render: expect.any(Function),
    }] }]);

    tab.display();

    expect(tab.containerEl.textContent).toContain("Finding available providers");
    expect(tab.containerEl.textContent).not.toContain("Get runtime");
    expect(tab.containerEl.textContent).toContain("Support development");
    expect(tab.containerEl.textContent).toContain("Patreon");
    await vi.waitFor(() => expect(transport.getProviders).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(tab.containerEl.textContent).toContain("OpenAI"));
    expect(plugin.startBackend).toHaveBeenCalledOnce();
    expect(tab.containerEl.textContent).not.toContain("Load providers");
    const names = Array.from(tab.containerEl.querySelectorAll(".chatobby-settings__provider .setting-item-name"))
      .map((element) => element.textContent);
    expect(names).toEqual(["DeepSeek (deepseek)", "OpenAI (openai)"]);
  });
});
