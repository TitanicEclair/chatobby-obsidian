import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendContextQueryScreenViewModel,
  FrontendIntent,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ContextQueriesView, type ContextQueryViewIntent } from "../ui/context-queries-view";

export interface ContextQueryScreenControllerOptions {
  getHost(): HTMLElement;
  getStore(): FrontendStore;
  getProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(): void;
  onClosed(renderChat: boolean): void;
}

/** Binds the runtime-owned project-query model to the native Obsidian view. */
export class ContextQueryScreenController {
  private view: ContextQueriesView | null = null;

  constructor(private readonly options: ContextQueryScreenControllerOptions) {}

  handleKeydown(event: KeyboardEvent): boolean {
    return this.view?.handleKeydown(event) ?? false;
  }

  open(): void {
    this.options.prepareOpen();
    this.view?.destroy();
    this.view = new ContextQueriesView({
      getModel: () => this.currentModel(),
      subscribe: (listener) => this.options.getStore().subscribe(() => listener(this.currentModel())),
      onBack: () => this.close(),
      onRefresh: () => this.refresh(),
      onIntent: (intent) => this.dispatch(intent),
    });
    this.options.onOpened();
    this.view.render(this.options.getHost());
    requestAnimationFrame(() => this.view?.focusContainer());
    void this.refresh();
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

  private async refresh(): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) return;
    await this.options.getProtocol().loadScreen({
      schemaVersion: 1,
      viewId: snapshot.viewId,
      screenId: "queries",
    });
    this.view?.setLocalError(null);
  }

  private async dispatch(input: ContextQueryViewIntent): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
    const intent = {
      schemaVersion: 1 as const,
      intentId: crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
      expectedRevision: snapshot.revision,
      ...input,
    } as FrontendIntent;
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      throw new Error(outcome.notice?.message ?? "The query action could not be applied.");
    }
    this.view?.setLocalError(null);
  }

  private currentModel(): FrontendContextQueryScreenViewModel | null {
    return this.options.getStore().snapshot?.screenModels.find(
      (screen): screen is FrontendContextQueryScreenViewModel => screen.screenId === "queries",
    ) ?? null;
  }
}
