import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendEventScreenViewModel,
  FrontendIntent,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { EventsView, type EventViewIntent } from "../ui/events-view";

export interface EventsScreenControllerOptions {
  getHost(): HTMLElement;
  getStore(): FrontendStore;
  getProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(): void;
  onClosed(renderChat: boolean): void;
}

/** Binds the runtime-owned Events read model to the native Obsidian renderer. */
export class EventsScreenController {
  private view: EventsView | null = null;

  constructor(private readonly options: EventsScreenControllerOptions) {}

  handleKeydown(event: KeyboardEvent): boolean {
    return this.view?.handleKeydown(event) ?? false;
  }

  open(): void {
    this.options.prepareOpen();
    this.view?.destroy();
    this.view = new EventsView({
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
    await this.options.getProtocol().loadScreen({ schemaVersion: 1, viewId: snapshot.viewId, screenId: "events" });
    this.view?.setLocalError(null);
  }

  private async dispatch(input: EventViewIntent): Promise<void> {
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
      throw new Error(outcome.notice?.message ?? "The event action could not be applied.");
    }
    this.view?.setLocalError(null);
  }

  private currentModel(): FrontendEventScreenViewModel | null {
    return this.options.getStore().snapshot?.screenModels.find(
      (screen): screen is FrontendEventScreenViewModel => screen.screenId === "events",
    ) ?? null;
  }
}
