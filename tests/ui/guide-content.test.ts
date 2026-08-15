import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
  CHATOBBY_GUIDE_DIRECTORY,
  CHATOBBY_GUIDE_FILES,
  CHATOBBY_GUIDE_MARKDOWN,
  downloadChatobbyGuide,
} from "../../src/features/guide/public";

describe("Chatobby guide", () => {
  it("ships a linked folder whose index targets all exist", () => {
    expect(CHATOBBY_GUIDE_FILES).toHaveLength(11);
    const paths = new Set(CHATOBBY_GUIDE_FILES.map((file) => file.path));
    const links = [...CHATOBBY_GUIDE_MARKDOWN.matchAll(/\[\[([^|\]]+)/gu)].map(
      (match) => match[1]!,
    );
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      expect(paths.has(`${CHATOBBY_GUIDE_DIRECTORY}/${link}.md`)).toBe(true);
    }
  });

  it("provides beginner-facing explanations, workflows, and connected navigation", () => {
    const completeGuide = CHATOBBY_GUIDE_FILES.map((file) => file.content).join(
      "\n",
    );
    expect(completeGuide.length).toBeGreaterThan(20_000);
    expect(completeGuide).toContain("much like a group chat");
    expect(completeGuide).toContain("Give an agent channel access");
    expect(completeGuide).toContain("secret name versus secret value");
    expect(completeGuide).toContain(
      "Creating a secret does not automatically link it",
    );
    expect(completeGuide).toContain("Which account sign-ins work?");
    expect(completeGuide).toContain(
      "Connection and managed process are different",
    );
    expect(completeGuide).toContain(
      "chats cannot use it until you restore a connection",
    );
    expect(completeGuide).toContain(
      "A message sent during automatic compaction is accepted once",
    );
    expect(completeGuide).toContain("Native, user, and Project skills");
    expect(completeGuide).toContain("progressive loading");
    expect(completeGuide).toContain(
      "[[02 - Permissions and safety|Permissions]]",
    );
  });

  it("copies every guide page after one confirmation", async () => {
    const entries = new Map<string, TAbstractFile>();
    const createFolder = vi.fn(async (path: string) => {
      entries.set(path, new TFolder(path) as unknown as TAbstractFile);
    });
    const create = vi.fn(async (path: string) => {
      const file = new TFile(path);
      entries.set(path, file as unknown as TAbstractFile);
      return file;
    });
    const app = {
      vault: {
        getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
        createFolder,
        create,
        modify: vi.fn(async () => {}),
      },
    } as unknown as App;

    const result = downloadChatobbyGuide({
      app,
      getTransport: () => null,
    });
    document.body.querySelector<HTMLButtonElement>(".modal .mod-cta")?.click();
    await result;

    expect(createFolder).toHaveBeenCalledWith(CHATOBBY_GUIDE_DIRECTORY);
    expect(create).toHaveBeenCalledTimes(CHATOBBY_GUIDE_FILES.length);
    expect(entries.has(`${CHATOBBY_GUIDE_DIRECTORY}/00 - Start Here.md`)).toBe(
      true,
    );
  });

  it("rejects a runtime guide file outside the guide folder", async () => {
    const created: string[] = [];
    const entries = new Map<string, TAbstractFile>();
    const app = {
      vault: {
        getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
        createFolder: async (path: string) => {
          entries.set(path, new TFolder(path) as unknown as TAbstractFile);
        },
        create: async (path: string) => {
          created.push(path);
          const file = new TFile(path);
          entries.set(path, file as unknown as TAbstractFile);
          return file;
        },
        modify: vi.fn(async () => {}),
      },
    } as unknown as App;

    const result = downloadChatobbyGuide({
      app,
      getTransport: () => ({
        getGuide: async () => ({
          content: "unsafe",
          path: "Outside.md",
          title: "Unsafe",
          version: "test",
          earlyAccess: true,
          confirmationNotice: "Confirm",
          files: [
            { path: "../Outside.md", title: "Unsafe", content: "unsafe" },
          ],
        }),
      }),
    });
    await Promise.resolve();
    document.body.querySelector<HTMLButtonElement>(".modal .mod-cta")?.click();
    await result;

    expect(created).toEqual(CHATOBBY_GUIDE_FILES.map((file) => file.path));
  });
});
