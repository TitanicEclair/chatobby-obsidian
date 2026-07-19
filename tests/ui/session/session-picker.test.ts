import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SessionPickerComponent } from "../../../src/ui/session/session-picker";
import type { SessionListItem } from "../../../src/types";
import type { SessionPickerProps } from "../../../src/ui/session/session-picker";
import { mount } from "../helpers/mount";
import { Menu } from "obsidian";

const directories = [
  { vaultDirectoryPath: "", cwd: "C:/vault", label: "Vault /" },
  { vaultDirectoryPath: "Projects", cwd: "C:/vault/Projects", label: "/Projects" },
];

function session(overrides: Partial<SessionListItem>): SessionListItem {
  return {
    path: "C:/sessions/one.jsonl",
    id: "one",
    cwd: "C:/vault",
    created: new Date("2026-07-01T00:00:00.000Z"),
    modified: new Date("2026-07-02T00:00:00.000Z"),
    messageCount: 3,
    firstMessage: "First request",
    ...overrides,
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("SessionPickerComponent", () => {
  it("retries discovery through the current transport after a connection failure", async () => {
    const listSessions = vi.fn(async () => []);
    const getTransport = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ listSessions, deleteSession: vi.fn(async () => ({ sessionId: "deleted" })) });
    const picker = new SessionPickerComponent({
      getTransport,
      directories,
      initialDirectoryPath: "",
      onSelect: vi.fn(async () => {}),
      onUseDirectory: vi.fn(),
      onCreateSession: vi.fn(async () => {}),
      onDelete: vi.fn(async () => {}),
      onAdvancedAction: vi.fn(async () => {}),
    });
    const root = mount(picker);
    await settle();

    expect(root.textContent).toContain("Chatobby backend is not connected");
    root.querySelector<HTMLButtonElement>(".chatobby-session-picker__state button")?.click();
    await settle();

    expect(getTransport).toHaveBeenCalledTimes(2);
    expect(listSessions).toHaveBeenCalledWith("C:/vault", true);
    expect(root.textContent).toContain("No stored sessions");
  });

  it("moves through sessions and selects the active row with Enter", async () => {
    const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    try {
      const selected: string[] = [];
      const listCalls: Array<[string | undefined, boolean | undefined]> = [];
      const picker = new SessionPickerComponent({
        getTransport: async () => ({
          listSessions: async (cwdOverride?: string, includeDescendants?: boolean) => {
            listCalls.push([cwdOverride, includeDescendants]);
            return [
              session({ path: "C:/sessions/one.jsonl", id: "one", cwd: "C:/vault/Projects", firstMessage: "First request" }),
              session({ path: "C:/sessions/two.jsonl", id: "two", cwd: "C:/vault/Projects", firstMessage: "Second request" }),
            ];
          },
          deleteSession: vi.fn(async () => ({ sessionId: "deleted" })),
        }),
        directories,
        initialDirectoryPath: "Projects",
        onSelect: async (path) => { selected.push(path); },
        onUseDirectory: vi.fn(),
        onCreateSession: vi.fn(async () => {}),
        onDelete: vi.fn(async () => {}),
        onAdvancedAction: vi.fn(async () => {}),
      });

      mount(picker);
      await settle();

      expect(listCalls).toEqual([["C:/vault", true]]);
      expect(picker.current()?.id).toBe("one");
      picker.handleKeydown(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      expect(picker.current()?.id).toBe("two");
      picker.handleKeydown(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(selected).toEqual(["C:/sessions/two.jsonl"]);
    } finally {
      HTMLElement.prototype.scrollIntoView = previousScrollIntoView;
    }
  });

  it("shows an event-bound animated state while a selected session resumes", async () => {
    let completeResume: (() => void) | null = null;
    const onSelect = vi.fn(() => new Promise<void>((resolve) => { completeResume = resolve; }));
    const picker = new SessionPickerComponent({
      getTransport: async () => ({
        listSessions: async () => [session({ path: "C:/sessions/one.jsonl", id: "one" })],
      }),
      directories,
      initialDirectoryPath: "",
      onSelect,
      onUseDirectory: vi.fn(),
      onCreateSession: vi.fn(async () => {}),
      onDelete: vi.fn(async () => {}),
      onAdvancedAction: vi.fn(async () => {}),
    });
    const root = mount(picker);
    await settle();

    root.querySelector<HTMLButtonElement>(".chatobby-session-picker__item-open")?.click();
    await Promise.resolve();

    const loading = root.querySelector(".chatobby-session-picker__state.is-resuming");
    expect(loading?.getAttribute("role")).toBe("status");
    expect(loading?.getAttribute("aria-label")).toBe("Resuming session");
    expect(loading?.textContent).toBe("Resuming session");
    expect(loading?.querySelector(".chatobby-session-picker__loading-dots")).not.toBeNull();
    expect(root.querySelector(".chatobby-session-picker__item")).toBeNull();

    completeResume?.();
    await settle();
    expect(root.querySelector(".chatobby-session-picker__state.is-resuming")).toBeNull();
  });

  it("searches session titles across directories while resetting selection", async () => {
    const props: SessionPickerProps = {
      getTransport: async () => ({
        listSessions: async () => [
          session({ path: "C:/sessions/one.jsonl", id: "one", name: "Planning" }),
          session({ path: "C:/sessions/two.jsonl", id: "two", name: "Review" }),
          session({ path: "C:/sessions/three.jsonl", id: "three", cwd: "C:/vault/Projects", name: "Transport resume" }),
        ],
        deleteSession: vi.fn(async () => ({ sessionId: "deleted" })),
      }),
      directories,
      initialDirectoryPath: "",
      onSelect: vi.fn(async () => {}),
      onUseDirectory: vi.fn(),
      onCreateSession: vi.fn(async () => {}),
      onDelete: vi.fn(async () => {}),
      onAdvancedAction: vi.fn(async () => {}),
    };
    const picker = new SessionPickerComponent(props);
    const root = mount(picker);
    await settle();

    picker.move(1);
    expect(picker.current()?.id).toBe("two");

    const input = root.querySelector(".chatobby-session-picker__search");
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) return;
    input.value = "plan";
    input.dispatchEvent(new Event("input"));

    expect(picker.current()?.id).toBe("one");
    expect(root.querySelectorAll(".chatobby-session-picker__item")).toHaveLength(1);
    input.value = "transport";
    input.dispatchEvent(new Event("input"));
    expect(picker.current()?.id).toBe("three");
    expect(root.textContent).toContain("/Projects");
  });

  it("loads sessions for the selected directory and exposes directory actions", async () => {
    const listCalls: Array<[string | undefined, boolean | undefined]> = [];
    const onUseDirectory = vi.fn();
    const picker = new SessionPickerComponent({
      getTransport: async () => ({
        listSessions: async (cwdOverride?: string, includeDescendants?: boolean) => {
          listCalls.push([cwdOverride, includeDescendants]);
          return [];
        },
        deleteSession: vi.fn(async () => ({ sessionId: "deleted" })),
      }),
      directories,
      initialDirectoryPath: "",
      onSelect: vi.fn(async () => {}),
      onUseDirectory,
      onCreateSession: vi.fn(async () => {}),
      onDelete: vi.fn(async () => {}),
      onAdvancedAction: vi.fn(async () => {}),
    });
    const root = mount(picker);
    await settle();

    const projectButton = [...root.querySelectorAll<HTMLButtonElement>(".chatobby-session-picker__directory")]
      .find((button) => button.textContent === "Projects");
    projectButton?.click();
    await settle();
    expect(listCalls).toEqual([["C:/vault", true]]);

    const useButton = root.querySelector<HTMLButtonElement>("[aria-label='Use selected working directory']");
    useButton?.click();
    expect(onUseDirectory).toHaveBeenCalledWith(directories[1]);
  });

  it("deletes a stored session and refreshes directory session indicators", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const deleteSession = vi.fn(async () => {});
    try {
      const picker = new SessionPickerComponent({
        getTransport: async () => ({
          listSessions: async () => [session({ path: "C:/sessions/one.jsonl", id: "one" })],
          deleteSession,
        }),
        directories,
        initialDirectoryPath: "",
        onSelect: vi.fn(async () => {}),
        onUseDirectory: vi.fn(),
        onCreateSession: vi.fn(async () => {}),
        onDelete: deleteSession,
        onAdvancedAction: vi.fn(async () => {}),
      });
      const root = mount(picker);
      await settle();

      root.querySelector<HTMLElement>(".chatobby-session-picker__item")?.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true }),
      );
      const testMenu = Menu as unknown as {
        lastShown: { items: Array<{ title: string; callback: (() => void) | null }> } | null;
      };
      testMenu.lastShown?.items.find((item) => item.title === "Delete")?.callback?.();
      await settle();

      expect(deleteSession).toHaveBeenCalledWith(expect.objectContaining({ path: "C:/sessions/one.jsonl" }));
      expect(root.querySelectorAll(".chatobby-session-picker__item")).toHaveLength(0);
      expect(root.querySelector(".chatobby-session-picker__directory.has-sessions")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("routes advanced operations through the session-row menu", async () => {
    const onAdvancedAction = vi.fn(async () => {});
    const picker = new SessionPickerComponent({
      getTransport: async () => ({
        listSessions: async () => [session({ path: "C:/sessions/one.jsonl", id: "one" })],
        deleteSession: vi.fn(async () => ({ sessionId: "deleted" })),
      }),
      directories,
      initialDirectoryPath: "",
      onSelect: vi.fn(async () => {}),
      onUseDirectory: vi.fn(),
      onCreateSession: vi.fn(async () => {}),
      onDelete: vi.fn(async () => {}),
      onAdvancedAction,
    });
    const root = mount(picker);
    await settle();

    root.querySelector<HTMLElement>(".chatobby-session-picker__item")?.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true }),
    );
    const testMenu = Menu as unknown as {
      lastShown: { items: Array<{ title: string; callback: (() => void) | null }> } | null;
    };
    const clone = testMenu.lastShown?.items.find((item) => item.title === "Clone");
    clone?.callback?.();
    await settle();

    expect(onAdvancedAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "one" }),
      directories[0],
      "clone",
    );
    expect(root.querySelector(".chatobby-session-picker__more")).toBeNull();
    expect(root.querySelector(".chatobby-session-picker__delete")).toBeNull();
    expect(root.querySelector(".chatobby-session-picker__item-preview")).toBeNull();
  });

  it("collapses and expands directory branches with disclosure controls", async () => {
    const picker = new SessionPickerComponent({
      getTransport: async () => ({ listSessions: async () => [] }),
      directories,
      initialDirectoryPath: "",
      onSelect: vi.fn(async () => {}),
      onUseDirectory: vi.fn(),
      onCreateSession: vi.fn(async () => {}),
      onDelete: vi.fn(async () => {}),
      onAdvancedAction: vi.fn(async () => {}),
    });
    const root = mount(picker);
    await settle();

    const disclosure = root.querySelector<HTMLButtonElement>(".chatobby-session-picker__disclosure");
    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    disclosure?.click();
    expect(root.querySelectorAll(".chatobby-session-picker__directory")).toHaveLength(1);
    root.querySelector<HTMLButtonElement>(".chatobby-session-picker__disclosure")?.click();
    expect(root.querySelectorAll(".chatobby-session-picker__directory")).toHaveLength(2);
  });

  it("keeps the session name primary while progressively hiding narrow-pane metadata", async () => {
    const picker = new SessionPickerComponent({
      getTransport: async () => ({
        listSessions: async () => [session({ path: "C:/sessions/one.jsonl", id: "one", name: "Planning session" })],
      }),
      directories,
      initialDirectoryPath: "",
      onSelect: vi.fn(async () => {}),
      onUseDirectory: vi.fn(),
      onCreateSession: vi.fn(async () => {}),
      onDelete: vi.fn(async () => {}),
      onAdvancedAction: vi.fn(async () => {}),
    });
    const root = mount(picker);
    await settle();

    expect(root.querySelector(".chatobby-session-picker__item-title")?.textContent).toBe("Planning session");
    expect(root.querySelector(".chatobby-session-picker__item-meta-last")).not.toBeNull();
    expect(root.querySelector(".chatobby-session-picker__item-meta-created")).not.toBeNull();
    expect(root.querySelector(".chatobby-session-picker__item-meta-messages")?.textContent).toBe("3 messages");

    const css = readFileSync("src/ui/session/session-picker.css", "utf8");
    expect(css).toContain("container-name: chatobby-session-list");
    expect(css).toMatch(/button\.chatobby-session-picker__item-open[\s\S]*height: auto;[\s\S]*overflow: hidden;/u);
    expect(css).toMatch(/item-meta-messages[\s\S]*grid-row: 1 \/ span 2;/u);
    expect(css).toMatch(/@container chatobby-session-list \(max-width: 400px\)[\s\S]*item-meta-messages/u);
    expect(css).toMatch(/@container chatobby-session-list \(max-width: 320px\)[\s\S]*item-meta-created/u);
    expect(css).toMatch(/@container chatobby-session-list \(max-width: 220px\)[\s\S]*item-meta \{ display: none; \}/u);
    expect(css).not.toMatch(/item-title[^}]*display:\s*none/u);
  });
});
