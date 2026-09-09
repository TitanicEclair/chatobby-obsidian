import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { CHATOBBY_GUIDE_DIRECTORY, downloadChatobbyGuide } from "../../src/features/guide/public";
import {
  CHATOBBY_GUIDE_ASSET_FORMAT,
  CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION,
  CHATOBBY_GUIDE_PRODUCT,
  type ChatobbyGuideChannelAsset,
} from "../../src/vendor/chatobby-client/ws-client.js";

describe("external Chatobby guide", () => {
  it("copies every verified compatible-channel page after one confirmation", async () => {
    const entries = new Map<string, TAbstractFile>();
    const createFolder = vi.fn(async (path: string) => {
      entries.set(path, new TFolder(path) as unknown as TAbstractFile);
    });
    const create = vi.fn(async (path: string) => {
      const file = new TFile(path);
      entries.set(path, file as unknown as TAbstractFile);
      return file;
    });
    const app = appFixture(entries, createFolder, create);

    const result = downloadChatobbyGuide({ app, fetchGuide: async () => guideAsset() });
    await Promise.resolve();
    document.body.querySelector<HTMLButtonElement>(".modal .mod-cta")?.click();
    await result;

    expect(createFolder).toHaveBeenCalledWith(CHATOBBY_GUIDE_DIRECTORY);
    expect(create).toHaveBeenCalledTimes(2);
    expect(entries.has(`${CHATOBBY_GUIDE_DIRECTORY}/00 - Start Here.md`)).toBe(true);
  });

  it("leaves the existing vault guide untouched when download or verification fails", async () => {
    const existing = new TFile(`${CHATOBBY_GUIDE_DIRECTORY}/00 - Start Here.md`);
    const entries = new Map<string, TAbstractFile>([
      [CHATOBBY_GUIDE_DIRECTORY, new TFolder(CHATOBBY_GUIDE_DIRECTORY) as unknown as TAbstractFile],
      [existing.path, existing as unknown as TAbstractFile],
    ]);
    const create = vi.fn();
    const modify = vi.fn();
    const onError = vi.fn();
    const app = {
      vault: { getAbstractFileByPath: (path: string) => entries.get(path) ?? null, createFolder: vi.fn(), create, modify },
    } as unknown as App;

    await downloadChatobbyGuide({ app, fetchGuide: async () => { throw new Error("offline"); }, onError });

    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/left unchanged.*Retry/u));
    expect(create).not.toHaveBeenCalled();
    expect(modify).not.toHaveBeenCalled();
    expect(document.body.querySelector(".modal")).toBeNull();
  });
});

function guideAsset(): ChatobbyGuideChannelAsset {
  return {
    schemaVersion: CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION,
    product: CHATOBBY_GUIDE_PRODUCT,
    guideRevision: "2026-08-21.1",
    format: CHATOBBY_GUIDE_ASSET_FORMAT,
    indexPath: `${CHATOBBY_GUIDE_DIRECTORY}/00 - Start Here.md`,
    title: "Chatobby Guide",
    earlyAccess: true,
    confirmationNotice: "Copy this exact guide?",
    files: [
      { path: `${CHATOBBY_GUIDE_DIRECTORY}/00 - Start Here.md`, title: "Chatobby Guide", content: "# Chatobby Guide\n" },
      { path: `${CHATOBBY_GUIDE_DIRECTORY}/01 - Basics.md`, title: "Basics", content: "# Basics\n" },
    ],
  };
}

function appFixture(
  entries: Map<string, TAbstractFile>,
  createFolder: (path: string) => Promise<void>,
  create: (path: string) => Promise<TFile>,
): App {
  return {
    vault: {
      getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
      createFolder,
      create,
      modify: vi.fn(async () => {}),
    },
  } as unknown as App;
}
