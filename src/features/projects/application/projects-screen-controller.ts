import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendIntent,
  FrontendProjectScreenViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { App } from "obsidian";
import type { SessionAdvancedAction } from "../../../ui/session/session-maintenance";
import { ProjectsView, type ProjectsViewIntent } from "../ui/projects-view";

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
}

/** Binds the runtime-owned Projects projection to the native Obsidian page. */
export class ProjectsScreenController {
  private view: ProjectsView | null = null;

  constructor(private readonly options: ProjectsScreenControllerOptions) {}

  handleKeydown(event: KeyboardEvent): boolean {
    return this.view?.handleKeydown(event) ?? false;
  }

  open(projectId?: string): void {
    this.options.prepareOpen();
    if (this.view) {
      this.options.onOpened();
		void this.refreshAndSelect(projectId);
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
      onDeleteSession: (sessionId) => this.options.deleteSession(sessionId),
      onSessionAction: (sessionId, action) => this.options.runSessionAction(sessionId, action),
    });
    this.options.onOpened();
    this.view.render(this.options.getHost());
    window.requestAnimationFrame(() => this.view?.focusContainer());
    void this.refreshAndSelect(projectId);
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
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
		const intentId = crypto.randomUUID();
		const prepared = await this.prepareDirectoryCandidate(input, intentId);
    const intent = {
      schemaVersion: 1 as const,
			intentId,
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
			...prepared,
    } as FrontendIntent;
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      throw new Error(outcome.notice?.message ?? "The Project action could not be applied.");
    }
    this.view?.setLocalError(null);
    if (input.type === "session.create" || input.type === "session.resume-by-id") this.close();
  }

	private async prepareDirectoryCandidate(
		input: ProjectsViewIntent,
		intentId: string,
	): Promise<Pick<FrontendIntent, "type" | "payload">> {
		if (
			input.type !== "projects.create" &&
			input.type !== "projects.root-add" &&
			input.type !== "projects.root-relink"
		) return input;
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
