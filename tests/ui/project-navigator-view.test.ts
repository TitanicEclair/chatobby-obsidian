import { type WorkspaceLeaf } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type ChatobbyPlugin from "../../src/main";
import { FrontendResyncRequiredError, FrontendStore } from "../../src/frontend/frontend-store";
import { ProjectNavigatorView } from "../../src/features/projects/ui/project-navigator-view";
import type { FrontendBootstrap, FrontendProjectScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";

const harness = vi.hoisted(() => ({ store: null as FrontendStore | null, load: vi.fn<() => Promise<void>>() }));
vi.mock("../../src/ui/workspace/workspace-connection", () => ({
  WorkspaceConnection: class {
    store = harness.store!;
    protocol = { loadScreen: harness.load };
    async open() {}
    async close() {}
  },
}));

function screen(active: boolean, present = true): FrontendProjectScreenViewModel {
  const sessions = present ? [{ sessionId: "new-chat", workspaceBindingRevision: 1,
    workspace: { kind: "vault" as const }, name: "Garden planning", messageCount: 0, running: false, active }] : [];
  return { screenId: "projects", revision: 1, snapshotSequence: 1, loading: false, query: "",
    lifecycleFilter: "active", availabilityFilter: "all", sort: "activity-desc", sessionQuery: "",
    sessionSearchMode: "titles", sessionSort: "updated-desc", sessionSearchPage: 0,
    runningIn: { kind: "vault", label: "Vault", attachedRootIds: [] }, projects: [], sessionMoveProjects: [],
    vaultSessionCount: sessions.length, vaultSessions: sessions, navigatorSessions: sessions, runningRoots: [],
    lifecycleOptions: [], availabilityOptions: [], sortOptions: [], sessionSearchModeOptions: [], sessionSortOptions: [] };
}

function publish(active: boolean, present = true): void {
  publishModel(screen(active, present));
}

function publishModel(model: FrontendProjectScreenViewModel): void {
  harness.store!.replace({ schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime",
    viewId: "navigator", revision: 1, sequence: 1, session: null,
    composer: { controls: [], canSubmit: false }, agentRail: { items: [] },
    feed: { revision: 1, blocks: [] }, screens: [], screenModels: [model], localCommands: [],
  } as FrontendBootstrap);
}

describe("native chat navigator", () => {
  beforeEach(() => {
    vi.stubGlobal("createDiv", (options?: DomElementInfo) => document.createElement("div").createDiv(options));
    harness.store = new FrontendStore(); harness.load.mockReset(); publish(false, false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reveals independent batches, preserves expansion and scroll, and searches beyond the visible chats", async () => {
    const model = screen(false, false);
    const project = { projectId: "atlas", revision: 1, name: "Atlas", lifecycle: "active" as const,
      creationKind: "manual" as const, rootCount: 1, sessionCount: 12, availability: "available" as const,
      availabilityLabel: "Available", createdAt: "2026-09-08", updatedAt: "2026-09-08", activityAt: "2026-09-08" };
    const sessions = ["atlas", "vault"].flatMap((group) => Array.from({ length: group === "vault" ? 125 : 12 }, (_, i) => ({
      sessionId: `${group}-${i}`, workspaceBindingRevision: 1,
      workspace: group === "vault" ? { kind: "vault" as const } : { kind: "project" as const, projectId: group },
      name: `${group} chat ${i}`, messageCount: 1, running: false, active: false,
    })));
    const populated = { ...model, projects: [project], navigatorSessions: sessions, vaultSessionCount: 125 };
    const view = new ProjectNavigatorView({} as WorkspaceLeaf, { app: {} } as ChatobbyPlugin);
    Object.assign(view.app, { workspace: { requestSaveLayout: vi.fn() } });
    await view.onOpen(); document.body.append(view.contentEl); publishModel(populated);
    const list = view.contentEl.querySelector<HTMLElement>(".chatobby-navigator__list")!;
    const [atlas, vault] = [...list.children] as HTMLElement[];
    const rows = (group: HTMLElement) => group.querySelectorAll<HTMLButtonElement>(".chatobby-navigator__session-open");
    const more = (group: HTMLElement) => group.querySelector<HTMLButtonElement>(".chatobby-navigator__more")!;
    expect(rows(atlas)).toHaveLength(5); expect(rows(vault)).toHaveLength(50);
    const firstRow = rows(atlas)[0];
    list.scrollTop = 170; more(atlas).click();
    expect(list.scrollTop).toBe(170); expect(rows(atlas)).toHaveLength(10); expect(rows(vault)).toHaveLength(50);
    more(vault).click(); expect(rows(vault)).toHaveLength(100);
    const toggle = atlas.querySelector<HTMLButtonElement>(".chatobby-navigator__group-toggle")!;
    toggle.click(); expect(more(atlas).hasClass("is-hidden")).toBe(true);
    toggle.click(); expect(rows(atlas)).toHaveLength(10);
    publishModel({ ...populated, navigatorSessions: sessions.map((s, i) => ({ ...s, active: i === 0 })) });
    expect(rows(atlas)[0]).toBe(firstRow); expect(firstRow.parentElement?.hasClass("is-running")).toBe(true);
    more(atlas).focus(); more(atlas).click();
    expect(rows(atlas)).toHaveLength(12); expect(more(atlas).hasClass("is-hidden")).toBe(true);
    expect(document.activeElement).toBe(rows(atlas)[10]);
    more(vault).click(); expect(rows(vault)).toHaveLength(125); expect(more(vault).hasClass("is-hidden")).toBe(true);
    const search = view.contentEl.querySelector<HTMLInputElement>(".chatobby-navigator__search")!;
    search.value = "vault chat 124"; search.dispatchEvent(new Event("input"));
    expect(list.querySelectorAll(".chatobby-navigator__session")).toHaveLength(1);
    expect(list.textContent).toContain("vault chat 124");
    search.value = ""; search.dispatchEvent(new Event("input"));
    expect(list.querySelectorAll(".chatobby-navigator__session")).toHaveLength(137);
    await view.onClose(); view.contentEl.remove();
  });

  it("adds a first-turn chat, shows working, completion and working again on the same row", async () => {
    const view = new ProjectNavigatorView({} as WorkspaceLeaf, { app: {} } as ChatobbyPlugin);
    await view.onOpen();
    publish(true);
    const row = view.contentEl.querySelector<HTMLElement>(".chatobby-navigator__session")!;
    expect(row.textContent).toContain("Garden planning");
    expect(row.classList.contains("is-running")).toBe(true);
    expect(row.querySelector("[aria-label='Working']")).not.toBeNull();
    publish(false);
    expect(row.classList.contains("is-running")).toBe(false);
    expect(row.classList.contains("is-complete")).toBe(true);
    publish(true);
    expect(view.contentEl.querySelector(".chatobby-navigator__session")).toBe(row);
    expect(row.classList.contains("is-running")).toBe(true);
    expect(row.classList.contains("is-complete")).toBe(false);
    await view.onClose();
  });

  it("coalesces repeated directory notifications and stops refreshing after close", async () => {
    let release!: () => void;
    harness.load.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    harness.load.mockResolvedValue(undefined);
    const view = new ProjectNavigatorView({} as WorkspaceLeaf, { app: {} } as ChatobbyPlugin);
    await view.onOpen();
    view.refreshSessionDirectory();
    view.refreshSessionDirectory();
    view.refreshSessionDirectory();
    expect(harness.load).toHaveBeenCalledOnce();
    release();
    await vi.waitFor(() => expect(harness.load).toHaveBeenCalledTimes(2));
    await view.onClose();
    view.refreshSessionDirectory();
    expect(harness.load).toHaveBeenCalledTimes(2);
  });

  it("recovers when an in-flight directory response is overtaken by a live update", async () => {
    const view = new ProjectNavigatorView({} as WorkspaceLeaf, { app: {} } as ChatobbyPlugin);
    await view.onOpen();
    publish(false);
    const row = view.contentEl.querySelector<HTMLElement>(".chatobby-navigator__session")!;
    const list = view.contentEl.querySelector<HTMLElement>(".chatobby-navigator__list")!;
    list.scrollTop = 170;
    harness.load.mockImplementationOnce(async () => {
      const store = harness.store!;
      const snapshot = store.snapshot!;
      store.apply({ schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime", viewId: "navigator",
        scope: { kind: "view", viewId: "navigator" }, baseRevision: 1, revision: 2, sequence: 2,
        operations: [{ type: "screen.replace", screen: { ...screen(true), revision: 2 } }] });
      store.replaceScreen({ schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime",
        viewId: "navigator", requestId: "older-request", requestEpoch: 1, baseSequence: snapshot.sequence,
        screenRevision: 1, screen: screen(false) });
    });
    harness.load.mockResolvedValue(undefined);
    view.refreshSessionDirectory();
    await vi.waitFor(() => expect(harness.load).toHaveBeenCalledTimes(2));
    expect(view.contentEl.querySelector(".chatobby-navigator__session")).toBe(row);
    expect(row.hasClass("is-running")).toBe(true);
    expect(list.scrollTop).toBe(170);
    expect(view.contentEl.querySelector(".chatobby-navigator__status")?.hasClass("is-hidden")).toBe(true);
    await view.onClose();
  });

  it("keeps groups and chat rows mounted through collapse, expansion and activity refresh", async () => {
    const view = new ProjectNavigatorView({} as WorkspaceLeaf, { app: {} } as ChatobbyPlugin);
    Object.assign(view.app, { workspace: { requestSaveLayout: vi.fn() } });
    await view.onOpen();
    document.body.append(view.contentEl);
    publish(false);
    const list = view.contentEl.querySelector<HTMLElement>(".chatobby-navigator__list")!;
    const group = list.firstElementChild!;
    const children = group.querySelector<HTMLElement>(".chatobby-navigator__sessions")!;
    const row = children.firstElementChild;
    const toggle = group.querySelector<HTMLButtonElement>(".chatobby-navigator__group-toggle")!;
    const observer = new MutationObserver(() => {});
    observer.observe(list, { childList: true });
    observer.observe(children, { childList: true });
    toggle.focus();
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(children.classList.contains("is-hidden")).toBe(true);
    toggle.click();
    publish(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(children.firstElementChild).toBe(row);
    expect(row?.classList.contains("is-running")).toBe(true);
    expect(observer.takeRecords()).toEqual([]);
    expect(document.activeElement).toBe(toggle);
    observer.disconnect();
    await view.onClose();
    view.contentEl.remove();
  });

  it("bounds stale-response retries and still reports a genuine directory failure", async () => {
    const view = new ProjectNavigatorView({} as WorkspaceLeaf, { app: {} } as ChatobbyPlugin);
    await view.onOpen(); publish(true);
    harness.load.mockRejectedValue(new FrontendResyncRequiredError("overtaken", "stale-screen-response"));
    view.refreshSessionDirectory();
    await vi.waitFor(() => expect(harness.load).toHaveBeenCalledTimes(3));
    expect(view.contentEl.querySelector(".chatobby-navigator__status")?.hasClass("is-hidden")).toBe(true);
    expect(view.contentEl.querySelector(".chatobby-navigator__session")?.hasClass("is-running")).toBe(true);
    harness.load.mockRejectedValue(new Error("Could not read the session directory."));
    view.refreshSessionDirectory();
    await vi.waitFor(() => expect(view.contentEl.querySelector(".chatobby-navigator__status")?.textContent)
      .toBe("Could not read the session directory."));
    expect(harness.load).toHaveBeenCalledTimes(4);
    await view.onClose();
  });
});
