import { describe, expect, it, vi } from "vitest";
import type { FrontendProjectScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { ProjectsScreenController } from "../../src/features/projects/public";
import type { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";

const requestProjectMarkerRecovery = vi.hoisted(() => vi.fn());
vi.mock("../../src/features/projects/ui/project-marker-recovery-modal", () => ({ requestProjectMarkerRecovery }));

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
        sessionSearchPage: 0,
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

	it("registers several external folders under one durable draft and creates one atomic Project", async () => {
		const host = document.body.createDiv();
		const store = initializedStore();
		const registerProjectDirectoryCandidate = vi.fn(async (input: { absolutePath: string }) => ({
			schemaVersion: 1 as const,
			directoryCandidateRef: `candidate:${input.absolutePath.at(-1)}`,
			label: input.absolutePath.at(-1) ?? "folder",
			locationKind: "external" as const,
		}));
		const dispatch = vi.fn(async () => ({ status: "accepted" as const }));
		const protocol = { registerProjectDirectoryCandidate, dispatch } as unknown as FrontendProtocolController;
		const controller = new ProjectsScreenController({
			app: {} as never,
			getHost: () => host,
			getStore: () => store,
			getProtocol: () => protocol,
			prepareOpen: vi.fn(),
			onOpened: vi.fn(),
			onClosed: vi.fn(),
			deleteSession: vi.fn(async () => {}),
			runSessionAction: vi.fn(async () => {}),
		});

		controller["creationDraft"].updateDetails({ name: "Real external Project" });
		await controller["addCreationFolders"](["C:\\Y1S2\\chatopet", "D:\\plugins"]);
		controller["creationDraft"].makePrimary("candidate:s");
		await controller["submitCreationDraft"]();

		const registrations = registerProjectDirectoryCandidate.mock.calls.map(([input]) => input);
		expect(registrations).toHaveLength(2);
		expect(registrations[0]?.intentId).toBe(registrations[1]?.intentId);
		expect(registrations.map((input) => input.operation)).toEqual(["create", "create"]);
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: "projects.create",
			payload: expect.objectContaining({
				name: "Real external Project",
				rootMode: "use-existing-folders",
				primaryDirectoryCandidateRef: "candidate:s",
				roots: [
					expect.objectContaining({ directoryCandidateRef: "candidate:t", markerPolicy: "required" }),
					expect.objectContaining({ directoryCandidateRef: "candidate:s", markerPolicy: "required" }),
				],
			}),
		}));
	});

	it("registers root additions as one batch instead of sequential mutations", async () => {
		const registerProjectDirectoryCandidate = vi.fn(async (input: { absolutePath: string }) => ({
			schemaVersion: 1 as const,
			directoryCandidateRef: `candidate:${input.absolutePath}`,
			label: input.absolutePath,
			locationKind: "external" as const,
		}));
		const controller = new ProjectsScreenController({
			app: {} as never,
			getHost: () => document.body,
			getStore: () => initializedStore(),
			getProtocol: () => ({ registerProjectDirectoryCandidate }) as unknown as FrontendProtocolController,
			prepareOpen: vi.fn(), onOpened: vi.fn(), onClosed: vi.fn(),
			deleteSession: vi.fn(async () => {}), runSessionAction: vi.fn(async () => {}),
		});

		const prepared = await controller["prepareDirectoryCandidate"]({
			type: "projects.roots-add-batch",
			payload: {
				projectId: "project:alpha",
				expectedProjectRevision: 4,
				roots: [
					{ systemAbsolutePath: "C:\\one", markerPolicy: "required", directoryReuse: "none" },
					{ systemAbsolutePath: "D:\\two", markerPolicy: "disabled", directoryReuse: "none" },
				],
			},
		}, "batch-intent");

		expect(registerProjectDirectoryCandidate).toHaveBeenCalledTimes(2);
		expect(registerProjectDirectoryCandidate).toHaveBeenNthCalledWith(1, expect.objectContaining({
			intentId: "batch-intent", operation: "roots-add-batch", absolutePath: "C:\\one",
		}));
		expect(prepared).toEqual({
			type: "projects.roots-add-batch",
			payload: {
				projectId: "project:alpha",
				expectedProjectRevision: 4,
				roots: [
					{ directoryCandidateRef: "candidate:C:\\one", label: "C:\\one", markerPolicy: "required", directoryReuse: "none" },
					{ directoryCandidateRef: "candidate:D:\\two", label: "D:\\two", markerPolicy: "disabled", directoryReuse: "none" },
				],
			},
		});
	});

	it("resumes the matching session before navigating to an exact message hit", async () => {
		const store = initializedStore();
		const dispatch = vi.fn(async () => ({ status: "accepted" as const }));
		const navigateToMessageHit = vi.fn(async () => {});
		const controller = new ProjectsScreenController({
			app: {} as never,
			getHost: () => document.body,
			getStore: () => store,
			getProtocol: () => ({ dispatch }) as unknown as FrontendProtocolController,
			prepareOpen: vi.fn(),
			onOpened: vi.fn(),
			onClosed: vi.fn(),
			deleteSession: vi.fn(async () => {}),
			runSessionAction: vi.fn(async () => {}),
			navigateToMessageHit,
		});
		const hit = {
			hitId: "entry-1:0",
			sessionId: "session:one",
			sessionName: "Plan Alpha",
			messageId: "entry-1",
			targetBlockId: "history:message:entry-1:user",
			role: "user" as const,
			timestamp: "2026-08-02T00:00:00.000Z",
			excerpt: "recovery journal",
			matchRanges: [{ start: 0, end: 16 }],
		};

		await controller["openMessageHit"](hit);

		expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: "session.resume-by-id",
			payload: { sessionId: "session:one" },
		}));
		expect(navigateToMessageHit).toHaveBeenCalledWith(hit);
	});

	it("offers an explicit device-only retry after a marker failure without falling back to a vault folder", async () => {
		requestProjectMarkerRecovery.mockReset();
		requestProjectMarkerRecovery.mockResolvedValueOnce("device-only");
		const store = initializedStore();
		const registerProjectDirectoryCandidate = vi.fn(async (input: { intentId: string }) => ({
			schemaVersion: 1 as const,
			directoryCandidateRef: `candidate:${input.intentId}`,
			label: "External",
			locationKind: "external" as const,
		}));
		const dispatch = vi.fn()
			.mockResolvedValueOnce({
				status: "rejected" as const,
				errorCode: "PROJECT_DIRECTORY_MARKER_INVALID",
				notice: { level: "error" as const, message: "The marker could not be written." },
			})
			.mockResolvedValueOnce({ status: "accepted" as const });
		const controller = new ProjectsScreenController({
			app: {} as never,
			getHost: () => document.body,
			getStore: () => store,
			getProtocol: () => ({ dispatch, registerProjectDirectoryCandidate }) as unknown as FrontendProtocolController,
			prepareOpen: vi.fn(), onOpened: vi.fn(), onClosed: vi.fn(),
			deleteSession: vi.fn(async () => {}), runSessionAction: vi.fn(async () => {}),
		});
		controller["creationDraft"].updateDetails({ name: "Marker fallback" });
		controller["creationDraft"].addRegisteredRoots([{
			directoryCandidateRef: "candidate-external",
			label: "External",
			localPath: "C:\\External",
		}]);

		expect(await controller["submitCreationDraft"]()).toBe(true);
		expect(requestProjectMarkerRecovery).toHaveBeenCalledWith({}, {
			canUseDeviceOnly: true,
			detail: "The marker could not be written.",
		});
		expect(dispatch).toHaveBeenCalledTimes(2);
		expect(registerProjectDirectoryCandidate).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0]?.[0].intentId).not.toBe(dispatch.mock.calls[1]?.[0].intentId);
		expect(dispatch.mock.calls.map(([intent]) => intent.payload)).toEqual([
			expect.objectContaining({
				rootMode: "use-existing-folders",
				markerPolicy: "required",
				roots: [expect.objectContaining({ markerPolicy: "required" })],
			}),
			expect.objectContaining({
				rootMode: "use-existing-folders",
				markerPolicy: "disabled",
				roots: [expect.objectContaining({ markerPolicy: "disabled" })],
			}),
		]);
		expect(dispatch.mock.calls.every(([intent]) => intent.payload.rootMode !== "create-vault-folder")).toBe(true);
	});

	it("re-registers a failed batch under a fresh intent before device-only retry", async () => {
		requestProjectMarkerRecovery.mockReset();
		requestProjectMarkerRecovery.mockResolvedValueOnce("device-only");
		const store = initializedStore();
		const registerProjectDirectoryCandidate = vi.fn(async (input: { intentId: string; absolutePath: string }) => ({
			schemaVersion: 1 as const,
			directoryCandidateRef: `candidate:${input.intentId}:${input.absolutePath}`,
			label: input.absolutePath,
			locationKind: "external" as const,
		}));
		const dispatch = vi.fn()
			.mockResolvedValueOnce({
				status: "rejected" as const,
				errorCode: "PROJECT_DIRECTORY_MARKER_INVALID",
				notice: { level: "error" as const, message: "Marker unavailable" },
			})
			.mockResolvedValueOnce({ status: "accepted" as const });
		const controller = new ProjectsScreenController({
			app: {} as never,
			getHost: () => document.body,
			getStore: () => store,
			getProtocol: () => ({ dispatch, registerProjectDirectoryCandidate }) as unknown as FrontendProtocolController,
			prepareOpen: vi.fn(), onOpened: vi.fn(), onClosed: vi.fn(),
			deleteSession: vi.fn(async () => {}), runSessionAction: vi.fn(async () => {}),
		});

		await controller["dispatch"]({
			type: "projects.roots-add-batch",
			payload: {
				projectId: "project:alpha",
				expectedProjectRevision: 4,
				roots: [
					{ systemAbsolutePath: "C:\\one", markerPolicy: "required", directoryReuse: "none" },
					{ systemAbsolutePath: "D:\\two", markerPolicy: "required", directoryReuse: "none" },
				],
			},
		});

		expect(dispatch).toHaveBeenCalledTimes(2);
		expect(registerProjectDirectoryCandidate).toHaveBeenCalledTimes(4);
		const firstIntentId = dispatch.mock.calls[0]?.[0].intentId;
		const secondIntentId = dispatch.mock.calls[1]?.[0].intentId;
		expect(firstIntentId).not.toBe(secondIntentId);
		expect(dispatch.mock.calls[0]?.[0].payload.roots).toEqual([
			expect.objectContaining({ markerPolicy: "required" }),
			expect.objectContaining({ markerPolicy: "required" }),
		]);
		expect(dispatch.mock.calls[1]?.[0].payload.roots).toEqual([
			expect.objectContaining({ markerPolicy: "disabled" }),
			expect.objectContaining({ markerPolicy: "disabled" }),
		]);
	});
});

function initializedStore(): FrontendStore {
	const store = new FrontendStore();
	store.replace({
		schemaVersion: 1,
		protocolVersion: 1,
		runtimeInstanceId: "runtime-1",
		revision: 1,
		viewId: "view-1",
		session: null,
		composer: { controls: [], canSubmit: true },
		agentRail: { items: [] },
		feed: { revision: 0, blocks: [] },
		screens: [], screenModels: [], localCommands: [],
	});
	return store;
}

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
    sessionSearchPage: 0,
    selectedProjectId: "project:alpha",
    runningIn: { kind: "vault", label: "Vault", attachedRootIds: [] },
    projects: [],
    vaultSessionCount: 0,
    vaultSessions: [],
    runningRoots: [],
    lifecycleOptions: [{ value: "active", label: "Active projects" }],
    availabilityOptions: [{ value: "all", label: "Any availability" }],
    sortOptions: [{ value: "activity-desc", label: "Recent activity" }],
    sessionSearchModeOptions: [{ value: "titles", label: "Names and opening prompts" }],
    sessionSortOptions: [{ value: "updated-desc", label: "Last used" }],
  };
}
