import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Menu, type App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { FrontendProjectScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { ProjectsView, type ProjectsViewIntent } from "../../src/features/projects/ui/projects-view";
import { mount } from "./helpers/mount";

const chooseSystemDirectories = vi.hoisted(() => vi.fn<() => Promise<readonly string[]>>());
vi.mock("../../src/features/projects/infrastructure/system-directory-picker", () => ({ chooseSystemDirectories }));

function projectModel(overrides: Partial<FrontendProjectScreenViewModel> = {}): FrontendProjectScreenViewModel {
  return {
    screenId: "projects",
    revision: 4,
    snapshotSequence: 8,
    loading: false,
    query: "",
    lifecycleFilter: "active",
    availabilityFilter: "all",
    sort: "activity-desc",
    sessionQuery: "",
    sessionSearchMode: "titles",
    sessionSort: "updated-desc",
    selectedProjectId: "project:alpha",
    runningIn: { kind: "vault", label: "Vault", attachedRootIds: [] },
    projects: [{
      projectId: "project:alpha",
      revision: 2,
      name: "Alpha",
      description: "A test Project",
      lifecycle: "active",
      creationKind: "manual",
      primaryRootId: "root:alpha",
      primaryRootLabel: "Alpha",
      rootCount: 1,
      sessionCount: 1,
      availability: "available",
      availabilityLabel: "Ready",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      activityAt: "2026-08-02T00:00:00.000Z",
    }],
	sessionMoveProjects: [
	  { projectId: "project:alpha", name: "Alpha", available: true, availabilityLabel: "Ready" },
	  { projectId: "project:beta", name: "Beta", available: true, availabilityLabel: "Ready" },
	],
    vaultSessions: [],
    detail: {
      projectId: "project:alpha",
      revision: 2,
      name: "Alpha",
      description: "A test Project",
      lifecycle: "active",
      creationKind: "manual",
      primaryRootId: "root:alpha",
	  sessionCount: 1,
      roots: [{
        rootId: "root:alpha",
        directoryId: "directory:alpha",
        label: "Alpha",
        primary: true,
        locationKind: "vault-relative",
        vaultRelativePath: "Projects/Alpha",
        directoryReuse: "canonical",
        markerPolicy: "required",
        recoveryMode: "marker",
        availability: "available",
        availabilityLabel: "Available on this device",
      }],
      sessions: [{
        sessionId: "session:one",
		workspaceBindingRevision: 3,
		workspace: { kind: "project", projectId: "project:alpha" },
        name: "Plan Alpha",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
        messageCount: 7,
        running: false,
        activeRootId: "root:alpha",
      }],
    },
	vaultSessionCount: 0,
    lifecycleOptions: [
      { value: "active", label: "Active projects" },
      { value: "archived", label: "Archived projects" },
      { value: "all", label: "All projects" },
    ],
    availabilityOptions: [{ value: "all", label: "Any availability" }],
    sortOptions: [{ value: "activity-desc", label: "Recent activity" }],
    sessionSearchModeOptions: [
	  { value: "titles", label: "Names and opening prompts" },
	  { value: "messages", label: "Include message contents" },
	],
    sessionSortOptions: [
	  { value: "updated-desc", label: "Last used" },
	  { value: "relevance", label: "Best match" },
	],
    ...overrides,
  };
}

function harness(options: {
  model?: FrontendProjectScreenViewModel;
  onIntent?: (intent: ProjectsViewIntent) => Promise<void>;
  app?: App;
} = {}) {
  let model = options.model ?? projectModel();
  const listeners = new Set<(value: FrontendProjectScreenViewModel | null) => void>();
  const onIntent = vi.fn(options.onIntent ?? (async () => {}));
  const onRefresh = vi.fn(async () => {});
  const view = new ProjectsView({
    app: options.app ?? ({} as App),
    getModel: () => model,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onBack: vi.fn(),
    onRefresh,
    onIntent,
    onDeleteSession: vi.fn(async () => {}),
    onSessionAction: vi.fn(async () => {}),
  });
  return {
    view,
    onIntent,
    onRefresh,
    setModel(value: FrontendProjectScreenViewModel): void {
      model = value;
      for (const listener of listeners) listener(value);
    },
  };
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const result = [...root.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.trim() === label || candidate.getAttribute("aria-label") === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}

describe("ProjectsView", () => {
	it("isolates the Project rail from theme-wide aside sizing", () => {
		const css = readFileSync(resolve(import.meta.dirname, "../../src/features/projects/ui/projects.css"), "utf8");
		expect(css).toMatch(/\.chatobby-projects__rail\s*\{[\s\S]*?max-width:\s*none;[\s\S]*?float:\s*none;/u);
		expect(css).toMatch(/\.chatobby-projects__detail-title h2\s*\{[\s\S]*?color:\s*var\(--text-normal\);[\s\S]*?text-overflow:\s*ellipsis;/u);
		expect(css).toMatch(/\.chatobby-projects__chat-open\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/u);
		expect(css).toContain("@container chatobby-page (max-width: 380px)");
	});

	it("renders a master-detail Project library without legacy tabs or developer state", () => {
    const root = mount(harness().view);

		expect(root.textContent).toContain("Chats and Projects");
		expect(root.textContent).toContain("Vault");
		expect(root.textContent).toContain("Folders");
		expect(root.textContent).toContain("Chats");
		expect(root.querySelectorAll(".chatobby-page__tab")).toHaveLength(0);
		expect(root.textContent).not.toContain("Viewing");
		expect(root.textContent).not.toContain("Available on this device");
		expect(root.textContent).not.toContain("Integrations");
  });

	it("keeps Project filters beside Project search and submits immediately on Enter", async () => {
		const instance = harness();
		const root = mount(instance.view);
		const search = root.querySelector<HTMLInputElement>('input[aria-label="Search Projects"]');
		const filters = root.querySelector(".chatobby-projects__rail-filters");
		const list = root.querySelector(".chatobby-projects__rail-list");
		if (!search || !filters || !list) throw new Error("Project discovery controls are unavailable");
		expect(filters.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
		search.value = "architecture";
		search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

		await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
			type: "projects.set-view",
			payload: expect.objectContaining({ query: "architecture", sort: "activity-desc" }),
		}));
	});

	it("searches the visible chat scope and exposes explicit message-content search", async () => {
		const instance = harness();
		const root = mount(instance.view);
		const search = root.querySelector<HTMLInputElement>('input[aria-label="Search chats"]');
		if (!search) throw new Error("Chat search is unavailable");
		search.value = "recovery journal";
		search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
			type: "projects.set-view",
			payload: expect.objectContaining({ sessionQuery: "recovery journal", sessionSearchMode: "titles" }),
		}));

		button(root, "Search inside chat messages").click();
		await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
			type: "projects.set-view",
			payload: expect.objectContaining({ sessionSearchMode: "messages" }),
		}));
	});

	it("keeps Create Project available while viewing a Project and opens it immediately", () => {
		const root = mount(harness().view);
		button(root, "Create Project").click();
		expect(root.textContent).toContain("Choose an existing folder, or leave it blank");
		expect(root.querySelector<HTMLInputElement>('input[aria-label="Project name"]')).not.toBeNull();
	});

	it("opens a stored Project session through its stable session ID", async () => {
		const instance = harness();
    const root = mount(instance.view);

		button(root, "Resume Plan Alpha").click();

    await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
      type: "session.resume-by-id",
      payload: { sessionId: "session:one" },
    }));
  });

	it("shows Vault chats in the same library and creates a Vault-root chat", async () => {
		const base = projectModel();
		const instance = harness({
			model: projectModel({
				selectedProjectId: undefined,
				detail: undefined,
				vaultSessions: [{
					sessionId: "session:vault",
					workspaceBindingRevision: 1,
					workspace: { kind: "vault" },
					name: "Vault planning",
					createdAt: "2026-08-01T00:00:00.000Z",
					updatedAt: "2026-08-03T00:00:00.000Z",
					messageCount: 3,
					running: true,
				}],
				vaultSessionCount: 1,
				projects: base.projects,
			}),
		});
		const root = mount(instance.view);

		expect(root.textContent).toContain("Chats that are not assigned to a Project.");
		expect(root.textContent).toContain("Vault planning");
		button(root, "New chat").click();

		await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
			type: "session.create",
			payload: { workspace: { kind: "vault" } },
		}));
	});

  it("keeps an edit form open and exposes the error when a mutation fails", async () => {
    const instance = harness({ onIntent: async () => { throw new Error("Project revision changed"); } });
    const root = mount(instance.view);
		openProjectMenu(root, "Alpha", "Edit name and description");
    const form = root.querySelector<HTMLFormElement>(".chatobby-projects__form");
    if (!form) throw new Error("Project details form is unavailable");

    form.dispatchEvent(new Event("submit"));

    await vi.waitFor(() => expect(root.textContent).toContain("Project revision changed"));
    expect(root.querySelector(".chatobby-projects__form")).not.toBeNull();
  });

  it("closes an editor after a successful mutation", async () => {
    const instance = harness();
    const root = mount(instance.view);
		openProjectMenu(root, "Alpha", "Edit name and description");
    const form = root.querySelector<HTMLFormElement>(".chatobby-projects__form");
    if (!form) throw new Error("Project details form is unavailable");

    form.dispatchEvent(new Event("submit"));

    await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalled());
    await vi.waitFor(() => expect(root.querySelector(".chatobby-projects__form")).toBeNull());
  });

  it("preserves an unsaved editor while a live Project snapshot refreshes", () => {
    const instance = harness();
    const root = mount(instance.view);
		openProjectMenu(root, "Alpha", "Edit name and description");
    const name = root.querySelector<HTMLInputElement>('input[aria-label="Project name"]');
    if (!name) throw new Error("Project name field is unavailable");
    name.value = "Unsaved local name";

    instance.setModel(projectModel({ revision: 5, snapshotSequence: 9 }));

    expect(root.querySelector<HTMLInputElement>('input[aria-label="Project name"]')?.value)
      .toBe("Unsaved local name");
  });

  it("uses Escape to close only the active Project editor", () => {
    const instance = harness();
    const root = mount(instance.view);
		openProjectMenu(root, "Alpha", "Edit name and description");
    const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });

    expect(instance.view.handleKeydown(event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(root.querySelector(".chatobby-projects__form")).toBeNull();
		expect(root.textContent).toContain("Folders");
  });

  it("renders explicit non-color recovery state for a missing root", () => {
    const base = projectModel();
    const detail = base.detail!;
    const root = mount(harness({
      model: projectModel({
      detail: {
          ...detail,
          roots: [{
            ...detail.roots[0]!,
            availability: "relink-required",
            availabilityLabel: "Choose this directory again",
            recoveryAction: "relink",
          }],
        },
      }),
    }).view);

    expect(root.textContent).toContain("Choose this directory again");
		expect(root.querySelector(".chatobby-projects__folder.is-relink-required")).not.toBeNull();
		button(root, "Folder actions for Alpha").click();
		expect(Menu.lastShown?.items.map((item) => item.title)).toContain("Choose folder again");
  });

	it("adds selected folders through revisioned Project intents", async () => {
		chooseSystemDirectories.mockResolvedValueOnce(["C:\\Projects\\Alpha docs"]);
		const instance = harness();
    const root = mount(instance.view);
		button(root, "Add folders").click();
		await vi.waitFor(() => expect(document.body.textContent).toContain(".chatobby-root.json"));
		const modal = document.body.querySelector<HTMLElement>(".modal");
		if (!modal) throw new Error("Folder confirmation is unavailable");
		button(modal, "Add folder").click();

    await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
      type: "projects.root-add",
      payload: {
        projectId: "project:alpha",
        expectedProjectRevision: 2,
				label: "Alpha docs",
				systemAbsolutePath: "C:\\Projects\\Alpha docs",
        directoryReuse: "none",
        markerPolicy: "required",
      },
    }));
  });

  it("exposes direct root actions and confirms before removing a Project folder", async () => {
    const base = projectModel();
    const detail = base.detail!;
    const secondary = {
      ...detail.roots[0]!,
      rootId: "root:docs",
      directoryId: "directory:docs",
      label: "Documentation",
      primary: false,
      vaultRelativePath: "Projects/Alpha docs",
      directoryReuse: "none" as const,
    };
    const instance = harness({
		model: projectModel({ detail: { ...detail, roots: [...detail.roots, secondary] } }),
    });
    const root = mount(instance.view);
		button(root, "Make Documentation primary").click();
		await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
			type: "projects.root-set-primary",
			payload: {
				projectId: "project:alpha",
				expectedProjectRevision: 2,
				rootId: "root:docs",
			},
		}));

		button(root, "Remove Documentation from Project").click();
		expect(document.body.textContent).toContain("Remove folder from Project?");
		button(document.body, "Remove").click();

    await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
      type: "projects.root-remove",
      payload: {
        projectId: "project:alpha",
        expectedProjectRevision: 2,
        rootId: "root:docs",
      },
    }));
  });

  it("requires confirmation before archiving a Project", async () => {
		const instance = harness();
    const root = mount(instance.view);

		openProjectMenu(root, "Alpha", "Archive Project");
		expect(document.body.textContent).toContain("Its folders and chats are preserved");
    expect(instance.onIntent).not.toHaveBeenCalled();
		button(document.body, "Archive").click();

    await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
      type: "projects.archive",
      payload: { projectId: "project:alpha", expectedProjectRevision: 2 },
    }));
  });

	it("creates a chat with stable Project identity rather than a cwd guess", async () => {
		const instance = harness();
		const root = mount(instance.view);
		button(root, "New chat in Project").click();
		await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
			type: "session.create",
			payload: { workspace: { kind: "project", projectId: "project:alpha" } },
		}));
	});

	it("moves a chat through a searchable picker with Vault pinned first", async () => {
		const instance = harness();
		const root = mount(instance.view);
		button(root, "More actions for Plan Alpha").click();
		clickLastMenuItem("Move chat…");
		await vi.waitFor(() => expect(document.body.textContent).toContain("Choose where"));
		const modal = document.body.querySelector<HTMLElement>(".modal");
		if (!modal) throw new Error("Move chat modal is unavailable");
		const destinations = modal.querySelectorAll<HTMLButtonElement>(".chatobby-projects__move-destination");
		expect(destinations[0]?.textContent).toContain("Vault");
		expect(destinations[0]?.classList.contains("is-sticky")).toBe(true);
		const search = modal.querySelector<HTMLInputElement>('input[aria-label="Search Projects"]');
		if (!search) throw new Error("Move chat search is unavailable");
		search.value = "beta";
		search.dispatchEvent(new Event("input", { bubbles: true }));
		expect(modal.textContent).toContain("Vault");
		expect(modal.textContent).toContain("Beta");
		expect(
			[...modal.querySelectorAll<HTMLElement>(".chatobby-projects__move-name")].map((element) => element.textContent),
		).toEqual(["Vault", "Beta"]);
		button(modal, "BetaMove this chat into this Project").click();

		await vi.waitFor(() => expect(instance.onIntent).toHaveBeenCalledWith({
			type: "projects.session-move",
			payload: {
				sessionId: "session:one",
				expectedWorkspaceBindingRevision: 3,
				target: { kind: "project", projectId: "project:beta" },
			},
		}));
		expect(instance.onRefresh).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(root.textContent).not.toContain("Plan Alpha"));

		const staleSource = projectModel();
		const movedSession = {
			...staleSource.detail!.sessions[0]!,
			workspace: { kind: "vault" as const },
		};
		instance.setModel(projectModel({
			detail: { ...staleSource.detail!, sessions: [movedSession] },
		}));
		expect(root.textContent).not.toContain("Plan Alpha");

		instance.setModel(projectModel({
			selectedProjectId: undefined,
			detail: undefined,
			vaultSessions: [movedSession],
			vaultSessionCount: 1,
		}));
		expect(root.textContent).toContain("Plan Alpha");
	});
});

function openProjectMenu(root: HTMLElement, project: string, item: string): void {
	button(root, `More actions for ${project}`).click();
	clickLastMenuItem(item);
}

function openRootMenu(root: HTMLElement, label: string, item: string): void {
	button(root, `Folder actions for ${label}`).click();
	clickLastMenuItem(item);
}

function clickLastMenuItem(title: string): void {
	const menu = Menu.lastShown;
	const item = menu?.items.find((candidate) => candidate.title === title);
	if (!item?.callback) throw new Error(`Missing menu item: ${title}`);
	item.callback();
}
