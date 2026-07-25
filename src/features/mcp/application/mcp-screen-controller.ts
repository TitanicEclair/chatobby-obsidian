import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendIntent,
  FrontendMcpScreenViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { McpView, type McpViewIntent } from "../ui/mcp-view";

export interface McpScreenControllerOptions {
  getHost(): HTMLElement;
  getStore(): FrontendStore;
  getProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(): void;
  onClosed(renderChat: boolean): void;
}

/** Binds the runtime-owned MCP management model to the native Obsidian view. */
export class McpScreenController {
  private readonly options: McpScreenControllerOptions;
  private view: McpView | null = null;

  constructor(options: McpScreenControllerOptions) {
    this.options = options;
  }

  handleKeydown(event: KeyboardEvent): boolean {
    return this.view?.handleKeydown(event) ?? false;
  }

  open(): void {
    this.options.prepareOpen();
    this.view?.destroy();
    this.view = new McpView({
      getModel: () => this.currentModel(),
      subscribe: (listener) => this.options.getStore().subscribeSelector(
        (snapshot) => snapshot.screenModels.find(
          (screen): screen is FrontendMcpScreenViewModel => screen.screenId === "mcp",
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
    try {
      await this.options.getProtocol().loadScreen({
        schemaVersion: 1,
        viewId: snapshot.viewId,
        screenId: "mcp",
      });
      this.view?.setLocalError(null);
    } catch (error) {
      this.view?.setLocalError(errorMessage(error));
    }
  }

  private async dispatch(input: McpViewIntent): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
    const intent = {
      schemaVersion: 1 as const,
      intentId: crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
      ...input,
    } as FrontendIntent;
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      throw new Error(outcome.notice?.message ?? "The MCP action could not be applied.");
    }
    this.view?.setLocalError(null);
  }

  private currentModel(): FrontendMcpScreenViewModel | null {
    return this.options.getStore().snapshot?.screenModels.find(
      (screen): screen is FrontendMcpScreenViewModel => screen.screenId === "mcp",
    ) ?? null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
