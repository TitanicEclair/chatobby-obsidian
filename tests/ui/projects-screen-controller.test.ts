import { describe, expect, it, vi } from "vitest";
import type { FrontendProjectScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { ProjectsScreenController } from "../../src/features/projects/public";
import type { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";

describe("ProjectsScreenController", () => {
	it("opens a requested Project in the unified overview after the first screen load", async () => {
    const host = document.body.createDiv();
    const store = new FrontendStore();
    store.replace({
      schemaVersion: 1,
      protocolVersion: 1,
      runtimeInstanceId: "runtime-1",
      revision: 0,
      viewId: "view-1",
      session: null,
      composer: { controls: [], canSubmit: true },
      agentRail: { items: [] },
      feed: { revision: 0, blocks: [] },
      screens: [],
      screenModels: [],
      localCommands: [],
    });
    const loadScreen = vi.fn(async () => {
      const screen = projectScreen();
      store.replaceScreen(screen);
      return screen;
    });
    const dispatch = vi.fn(async () => ({ status: "accepted" as const }));
    const protocol = { loadScreen, dispatch } as unknown as FrontendProtocolController;
    const controller = new ProjectsScreenController({
      app: {} as never,
      getHost: () => host,
      getStore: () => store,
      getProtocol: () => protocol,
      prepareOpen: vi.fn(),
      onOpened: vi.fn(),
      onClosed: vi.fn(),
	});

	controller.open("project:alpha");

    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: "projects.set-view",
      payload: {
        query: "",
        lifecycleFilter: "active",
        availabilityFilter: "all",
        sort: "activity-desc",
        sessionQuery: "",
        sessionSearchMode: "titles",
        sessionSort: "updated-desc",
        selectedProjectId: "project:alpha",
      },
    })));
    expect(loadScreen).toHaveBeenCalledWith({
      schemaVersion: 1,
      viewId: "view-1",
      screenId: "projects",
      preferredEntityId: "project:alpha",
    });
    controller.destroy();
  });

	it("replaces a transient system path with an opaque runtime candidate before dispatch", async () => {
		const registerProjectDirectoryCandidate = vi.fn(async () => ({
			schemaVersion: 1 as const,
			directoryCandidateRef: "candidate-opaque",
			label: "External docs",
			locationKind: "external" as const,
		}));
		const protocol = { registerProjectDirectoryCandidate } as unknown as FrontendProtocolController;
		const controller = new ProjectsScreenController({
			app: {} as never,
			getHost: () => document.body,
			getStore: () => new FrontendStore(),
			getProtocol: () => protocol,
			prepareOpen: vi.fn(),
			onOpened: vi.fn(),
			onClosed: vi.fn(),
			deleteSession: vi.fn(async () => {}),
			runSessionAction: vi.fn(async () => {}),
		});

		const prepared = await controller["prepareDirectoryCandidate"]({
			type: "projects.root-add",
			payload: {
				projectId: "project:alpha",
				expectedProjectRevision: 2,
				label: "temporary",
				systemAbsolutePath: "C:\\Work\\External docs",
				directoryReuse: "none",
				markerPolicy: "required",
			},
		}, "intent-external");

		expect(registerProjectDirectoryCandidate).toHaveBeenCalledWith({
			schemaVersion: 1,
			intentId: "intent-external",
			operation: "root-add",
			absolutePath: "C:\\Work\\External docs",
		});
		expect(prepared).toEqual({
			type: "projects.root-add",
			payload: {
				projectId: "project:alpha",
				expectedProjectRevision: 2,
				label: "External docs",
				directoryReuse: "none",
				markerPolicy: "required",
				directoryCandidateRef: "candidate-opaque",
			},
		});
	});
});

function projectScreen(): FrontendProjectScreenViewModel {
  return {
    screenId: "projects",
    revision: 1,
    snapshotSequence: 1,
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
    projects: [],
    vaultSessionCount: 0,
    vaultSessions: [],
    lifecycleOptions: [{ value: "active", label: "Active projects" }],
    availabilityOptions: [{ value: "all", label: "Any availability" }],
    sortOptions: [{ value: "activity-desc", label: "Recent activity" }],
    sessionSearchModeOptions: [{ value: "titles", label: "Names and opening prompts" }],
    sessionSortOptions: [{ value: "updated-desc", label: "Last used" }],
  };
}
