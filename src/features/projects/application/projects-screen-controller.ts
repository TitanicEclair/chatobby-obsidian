import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendIntent,
  FrontendProjectMessageSearchHitViewModel,
  FrontendProjectRootViewModel,
  FrontendProjectScreenViewModel,
  FrontendProjectSessionViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { App } from "obsidian";
import type { SessionAdvancedAction } from "../../../ui/session/session-maintenance";
import { ProjectsView, type ProjectsViewIntent } from "../ui/projects-view";
import { requestProjectMarkerRecovery } from "../ui/project-marker-recovery-modal";
import {
	ProjectCreationDraftStore,
	type ProjectDraftMarkerPolicy,
} from "./project-creation-draft";

export interface ProjectsScreenControllerOptions {
  app: App;
  getHost(): HTMLElement;
  getStore(): FrontendStore;
  getProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(): void;
  onClosed(renderChat: boolean): void;
  deleteSession(sessionId: string): Promise<void>;
  runSessionAction(sessionId: string, action: SessionAdvancedAction): Promise<void>;
  navigateToMessageHit(hit: FrontendProjectMessageSearchHitViewModel): Promise<void>;
  openSessionIntent?(intent: Extract<ProjectsViewIntent, { type: "session.create" | "session.resume-by-id" }>): Promise<void>;
}

/** Binds the runtime-owned Projects projection to the native Obsidian page. */
export class ProjectsScreenController {
  private view: ProjectsView | null = null;
  private readonly creationDraft = new ProjectCreationDraftStore();

  constructor(private readonly options: ProjectsScreenControllerOptions) {}

  handleKeydown(event: KeyboardEvent): boolean {
    return this.view?.handleKeydown(event) ?? false;
  }

  async openEditor(projectId?: string): Promise<void> {
    this.open(projectId, false);
    await this.refresh(projectId);
    if (projectId) await this.view?.selectProject(projectId);
    this.view?.openEditor(!projectId);
  }

  showSessionMenu(event: MouseEvent, session: FrontendProjectSessionViewModel): void {
    if (!this.view) this.open();
    this.view?.showSessionMenu(event, session);
  }

  open(projectId?: string, refresh = true): void {
    this.options.prepareOpen();
    if (this.view) {
      this.options.onOpened();
		if (refresh) void this.refreshAndSelect(projectId);
      return;
    }
    this.view = new ProjectsView({
      app: this.options.app,
      getModel: () => this.currentModel(),
      subscribe: (listener) => this.options.getStore().subscribeSelector(
        (snapshot) => snapshot.screenModels.find(
          (screen): screen is FrontendProjectScreenViewModel => screen.screenId === "projects",
        ) ?? null,
        listener,
      ),
      onBack: () => this.close(),
      onRefresh: async () => { await this.refresh(); },
      onIntent: (intent) => this.dispatch(intent),
      getCreationDraft: () => this.creationDraft.snapshot(),
      resetCreationDraft: () => { this.creationDraft.reset(); },
      updateCreationDraft: (patch) => { this.creationDraft.updateDetails(patch); },
      setCreationMarkerPolicy: (markerPolicy) => { this.creationDraft.setMarkerPolicy(markerPolicy); },
      addCreationFolders: (paths) => this.addCreationFolders(paths),
      removeCreationFolder: (directoryCandidateRef) => { this.creationDraft.removeRoot(directoryCandidateRef); },
      makeCreationFolderPrimary: (directoryCandidateRef) => {
        this.creationDraft.makePrimary(directoryCandidateRef);
      },
      submitCreationDraft: () => this.submitCreationDraft(),
      onDeleteSession: (sessionId) => this.options.deleteSession(sessionId),
      onSessionAction: (sessionId, action) => this.options.runSessionAction(sessionId, action),
      onMessageHit: (hit) => this.openMessageHit(hit),
    });
    this.options.onOpened();
    this.view.render(this.options.getHost());
    window.requestAnimationFrame(() => this.view?.focusContainer());
    if (refresh) void this.refreshAndSelect(projectId);
  }

	async createForCurrentSession(input: {
		readonly name: string;
		readonly description?: string;
		readonly vaultRelativePath: string;
	}): Promise<void> {
		await this.dispatch({
			type: "projects.create",
			payload: {
				name: input.name,
				...(input.description ? { description: input.description } : {}),
				vaultRelativePath: input.vaultRelativePath,
				directoryReuse: "none",
				markerPolicy: "required",
				useForCurrentSession: true,
			},
		});
	}

	async createSession(projectId: string): Promise<void> {
		await this.dispatch({
			type: "session.create",
			payload: { workspace: { kind: "project", projectId } },
		});
	}

  close(renderChat = true): void {
    this.view?.destroy();
    this.view = null;
    this.options.onClosed(renderChat);
  }

  destroy(): void {
    this.close(false);
  }

  synchronize(): void {
    if (this.view) void this.refresh();
  }

  async getRunningReferenceWorkspace(): Promise<{
    readonly roots: readonly FrontendProjectRootViewModel[];
    readonly activeRootId?: string;
  }> {
    let model = this.currentModel();
    if (!model) {
      await this.refresh();
      model = this.currentModel();
    }
    return {
      roots: model?.runningRoots ?? [],
      activeRootId: model?.runningIn.activeRootId,
    };
  }

  private async refresh(projectId = this.currentModel()?.selectedProjectId): Promise<boolean> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) return false;
    try {
      await this.options.getProtocol().loadScreen({
        schemaVersion: 1,
        viewId: snapshot.viewId,
        screenId: "projects",
        ...(projectId ? { preferredEntityId: projectId } : {}),
      });
      this.view?.setLocalError(null);
      return true;
    } catch (error) {
      this.view?.setLocalError(errorMessage(error));
      return false;
    }
  }

	private async refreshAndSelect(projectId: string | undefined): Promise<void> {
		try {
			const loaded = await this.refresh(projectId);
			if (loaded && projectId) await this.view?.selectProject(projectId);
		} catch (error) {
			this.view?.setLocalError(errorMessage(error));
		}
	}

  private async dispatch(input: ProjectsViewIntent): Promise<void> {
    if (this.options.openSessionIntent && (input.type === "session.create" || input.type === "session.resume-by-id")) {
      await this.options.openSessionIntent(input);
      return;
    }
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
		let intentId = crypto.randomUUID();
		let prepared = await this.prepareDirectoryCandidate(input, intentId);
		try {
			await this.dispatchPrepared(prepared, intentId);
		} catch (error) {
			if (
				input.type !== "projects.roots-add-batch" ||
				!(error instanceof ProjectIntentError) ||
				!isMarkerError(error.errorCode)
			) throw error;
			const choice = await requestProjectMarkerRecovery(this.options.app, {
				canUseDeviceOnly: error.errorCode === "PROJECT_DIRECTORY_MARKER_INVALID",
				detail: error.message,
			});
			if (choice === "cancel") return;
			intentId = crypto.randomUUID();
			const retryInput: ProjectsViewIntent = choice === "device-only"
				? {
					type: input.type,
					payload: {
						...input.payload,
						roots: input.payload.roots.map((root) => ({ ...root, markerPolicy: "disabled" as const })),
					},
				}
				: input;
			prepared = await this.prepareDirectoryCandidate(retryInput, intentId);
			await this.dispatchPrepared(prepared, intentId);
		}
    if (input.type === "session.create" || input.type === "session.resume-by-id") this.close();
  }

  private async openMessageHit(hit: FrontendProjectMessageSearchHitViewModel): Promise<void> {
    await this.dispatch({
      type: "session.resume-by-id",
      payload: { sessionId: hit.sessionId },
    });
    await this.options.navigateToMessageHit(hit);
  }

  private async dispatchPrepared(
    prepared: Pick<FrontendIntent, "type" | "payload">,
    intentId: string,
  ): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
    const intent = {
      schemaVersion: 1 as const,
			intentId,
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
			...prepared,
    } as FrontendIntent;
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      throw new ProjectIntentError(
        outcome.notice?.message ?? "The Project action could not be applied.",
        outcome.status === "rejected" ? outcome.errorCode : undefined,
      );
    }
    this.view?.setLocalError(null);
  }

	private async addCreationFolders(paths: readonly string[]): Promise<void> {
		const draft = this.creationDraft.snapshot();
		const known = new Set(draft.roots.map((root) => normalizeLocalPath(root.localPath)));
		const additions = [...new Set(paths.map((path) => path.trim()).filter(Boolean))]
			.filter((path) => !known.has(normalizeLocalPath(path)));
		const registered = await Promise.all(additions.map(async (absolutePath) => {
			const candidate = await this.options.getProtocol().registerProjectDirectoryCandidate({
				schemaVersion: 1,
				intentId: draft.intentId,
				operation: "create",
				absolutePath,
			});
			return {
				directoryCandidateRef: candidate.directoryCandidateRef,
				label: candidate.label,
				localPath: absolutePath,
			};
		}));
		this.creationDraft.addRegisteredRoots(registered);
	}

	private async submitCreationDraft(): Promise<boolean> {
		const draft = this.creationDraft.snapshot();
		const name = draft.name.trim();
		if (!name) throw new Error("Enter a Project name.");
		if (draft.roots.length === 0) {
			await this.dispatchPrepared({
				type: "projects.create",
				payload: {
					name,
					...(draft.description.trim() ? { description: draft.description.trim() } : {}),
					rootMode: "create-vault-folder",
					directoryReuse: "none",
					markerPolicy: "required",
				},
			}, draft.intentId);
			return true;
		}
		const primaryDirectoryCandidateRef = draft.primaryDirectoryCandidateRef;
		if (!primaryDirectoryCandidateRef) throw new Error("Choose a primary Project folder.");
		try {
			await this.dispatchCreationWithRoots(draft);
			return true;
		} catch (error) {
			if (!(error instanceof ProjectIntentError) || !isMarkerError(error.errorCode)) throw error;
			const choice = await requestProjectMarkerRecovery(this.options.app, {
				canUseDeviceOnly: error.errorCode === "PROJECT_DIRECTORY_MARKER_INVALID",
				detail: error.message,
			});
			if (choice === "cancel") return false;
			const markerPolicy = choice === "device-only" ? "disabled" as const : draft.markerPolicy;
			await this.refreshCreationCandidates(markerPolicy);
			await this.dispatchCreationWithRoots(this.creationDraft.snapshot());
			return true;
		}
	}

	private async refreshCreationCandidates(markerPolicy: ProjectDraftMarkerPolicy): Promise<void> {
		const draft = this.creationDraft.snapshot();
		const primaryLocalPath = draft.roots.find(
			(root) => root.directoryCandidateRef === draft.primaryDirectoryCandidateRef,
		)?.localPath;
		const intentId = crypto.randomUUID();
		const roots = await Promise.all(draft.roots.map(async (root) => {
			const candidate = await this.options.getProtocol().registerProjectDirectoryCandidate({
				schemaVersion: 1,
				intentId,
				operation: "create",
				absolutePath: root.localPath,
			});
			return {
				directoryCandidateRef: candidate.directoryCandidateRef,
				label: candidate.label,
				localPath: root.localPath,
			};
		}));
		this.creationDraft.setMarkerPolicy(markerPolicy);
		this.creationDraft.replaceRegisteredRoots({ intentId, roots, primaryLocalPath });
	}

	private async dispatchCreationWithRoots(draft: ReturnType<ProjectCreationDraftStore["snapshot"]>): Promise<void> {
		const name = draft.name.trim();
		if (!name) throw new Error("Enter a Project name.");
		const primaryDirectoryCandidateRef = draft.primaryDirectoryCandidateRef;
		if (!primaryDirectoryCandidateRef) throw new Error("Choose a primary Project folder.");
		await this.dispatchPrepared({
			type: "projects.create",
			payload: {
				name,
				...(draft.description.trim() ? { description: draft.description.trim() } : {}),
				rootMode: "use-existing-folders",
				roots: draft.roots.map((root) => ({
					directoryCandidateRef: root.directoryCandidateRef,
					label: root.label,
					markerPolicy: draft.markerPolicy,
					directoryReuse: "none" as const,
				})),
				primaryDirectoryCandidateRef,
				directoryReuse: "none",
				markerPolicy: draft.markerPolicy,
			},
		}, draft.intentId);
	}

	private async prepareDirectoryCandidate(
		input: ProjectsViewIntent,
		intentId: string,
	): Promise<Pick<FrontendIntent, "type" | "payload">> {
		if (
			input.type !== "projects.create" &&
			input.type !== "projects.root-add" &&
			input.type !== "projects.roots-add-batch" &&
			input.type !== "projects.root-relink"
		) return input;
		if (input.type === "projects.roots-add-batch") {
			const candidates = await Promise.all(input.payload.roots.map(async (root) => {
				const candidate = await this.options.getProtocol().registerProjectDirectoryCandidate({
					schemaVersion: 1,
					intentId,
					operation: "roots-add-batch",
					absolutePath: root.systemAbsolutePath,
				});
				return {
					directoryCandidateRef: candidate.directoryCandidateRef,
					label: candidate.label,
					markerPolicy: root.markerPolicy,
					directoryReuse: root.directoryReuse,
				};
			}));
			return {
				type: input.type,
				payload: {
					projectId: input.payload.projectId,
					expectedProjectRevision: input.payload.expectedProjectRevision,
					roots: candidates,
				},
			};
		}
		const absolutePath = input.payload.systemAbsolutePath;
		if (!absolutePath) return input;
		const operation = input.type === "projects.create"
			? "create"
			: input.type === "projects.root-add"
				? "root-add"
				: "root-relink";
		const candidate = await this.options.getProtocol().registerProjectDirectoryCandidate({
			schemaVersion: 1,
			intentId,
			operation,
			absolutePath,
		});
		if (input.type === "projects.create") {
			const { systemAbsolutePath: _systemAbsolutePath, ...payload } = input.payload;
			return { type: input.type, payload: { ...payload, directoryCandidateRef: candidate.directoryCandidateRef } };
		}
		if (input.type === "projects.root-add") {
			const { systemAbsolutePath: _systemAbsolutePath, ...payload } = input.payload;
			return {
				type: input.type,
				payload: { ...payload, label: candidate.label, directoryCandidateRef: candidate.directoryCandidateRef },
			};
		}
		const { systemAbsolutePath: _systemAbsolutePath, ...payload } = input.payload;
		return { type: input.type, payload: { ...payload, directoryCandidateRef: candidate.directoryCandidateRef } };
	}

  private currentModel(): FrontendProjectScreenViewModel | null {
    return this.options.getStore().snapshot?.screenModels.find(
      (screen): screen is FrontendProjectScreenViewModel => screen.screenId === "projects",
    ) ?? null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeLocalPath(path: string): string {
	return path.trim().replace(/[\\/]+$/u, "").toLocaleLowerCase();
}

class ProjectIntentError extends Error {
	constructor(message: string, readonly errorCode?: string) {
		super(message);
		this.name = "ProjectIntentError";
	}
}

function isMarkerError(errorCode: string | undefined): boolean {
	return errorCode === "PROJECT_DIRECTORY_MARKER_INVALID" || errorCode === "PROJECT_DIRECTORY_MARKER_CONFLICT";
}
