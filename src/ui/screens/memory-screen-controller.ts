import type { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../frontend/frontend-store";
import type {
  FrontendIntent,
  FrontendMemoryScreenViewModel,
} from "../../vendor/chatobby-client/frontend-contracts.js";
import {
  isMemoryActionId,
  MemoryView,
  type MemoryActionId,
  type MemoryViewIntent,
} from "../memory/memory-view";

/** Host callbacks for presenting memory as an isolated full-view screen. */
export interface MemoryScreenControllerOptions {
  getHost(): HTMLElement;
  getStore(): FrontendStore;
  getProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(): void;
  onClosed(renderChat: boolean): void;
}

/** Binds the runtime-owned memory screen model to native Obsidian rendering. */
export class MemoryScreenController {
  private view: MemoryView | null = null;

  constructor(private readonly options: MemoryScreenControllerOptions) {}

  handleKeydown(event: KeyboardEvent): boolean {
    return this.view?.handleKeydown(event) ?? false;
  }

  open(runActionId?: MemoryActionId): void {
    this.options.prepareOpen();
    this.view?.destroy();
    this.view = new MemoryView({
      getModel: () => this.currentModel(),
      subscribe: (listener) => this.options.getStore().subscribeSelector(
        (snapshot) => snapshot.screenModels.find(
          (screen): screen is FrontendMemoryScreenViewModel => screen.screenId === "memory",
        ) ?? null,
        listener,
      ),
      onBack: () => this.close(),
      onRefresh: () => this.refresh(),
      onIntent: (intent) => this.dispatch(intent),
    });
    this.options.onOpened();
    this.view.render(this.options.getHost());
    window.requestAnimationFrame(() => this.view?.focusContainer());
    if (runActionId) window.requestAnimationFrame(() => this.view?.runActionById(runActionId));
    else void this.refresh();
  }

  openFromExtensionAction(id: string): boolean {
    if (!isMemoryActionId(id)) return false;
    this.open(id);
    return true;
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
    try {
      await this.options.getProtocol().loadScreen({
        schemaVersion: 1,
        viewId: snapshot.viewId,
        screenId: "memory",
      });
      this.view?.setLocalError(null);
    } catch (error) {
      this.view?.setLocalError(errorMessage(error));
    }
  }

  private async dispatch(input: MemoryViewIntent): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
	const revisionedInput = input.type === "memory.update-policy"
		? { ...input, payload: { ...input.payload, expectedMemoryRevision: this.currentModel()?.revision ?? 0 } }
		: input;
	const intent = {
      schemaVersion: 1 as const,
      intentId: crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
	  ...revisionedInput,
    } as FrontendIntent;
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      throw new Error(outcome.notice?.message ?? "The memory action could not be applied.");
    }
    this.view?.setLocalError(null);
  }

  private currentModel(): FrontendMemoryScreenViewModel | null {
    return this.options.getStore().snapshot?.screenModels.find(
      (screen): screen is FrontendMemoryScreenViewModel => screen.screenId === "memory",
    ) ?? null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
