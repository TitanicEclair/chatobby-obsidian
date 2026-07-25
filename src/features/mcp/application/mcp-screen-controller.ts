import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendIntent,
  FrontendMcpScreenViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type {
  FrontendPluginMcpScreenViewModel,
} from "../../../vendor/chatobby-client/frontend-plugin-contracts";
import type { App } from "obsidian";
import { McpView, type McpViewIntent } from "../ui/mcp-view";

export interface McpScreenControllerOptions {
  app: App;
  getHost(): HTMLElement;
  getStore(): FrontendStore;
  getProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(): void;
  onClosed(renderChat: boolean): void;
  onNavigatePlugin(pluginId?: string): void;
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

  open(pluginId?: string): void {
    this.options.prepareOpen();
    if (this.view) {
      this.view.setPluginRoute(pluginId);
      this.options.onOpened();
      void this.refresh(pluginId);
      return;
    }
    this.view = new McpView({
      app: this.options.app,
      getModel: () => this.currentModel(),
      subscribe: (listener) => this.options.getStore().subscribeSelector(
        (snapshot) => snapshot.screenModels.find(
          (screen): screen is FrontendPluginMcpScreenViewModel =>
            screen.screenId === "mcp" && isPluginMcpScreen(screen),
        ) ?? null,
        listener,
      ),
      onBack: () => this.close(),
      onRefresh: () => this.refresh(),
      onNavigatePlugin: (nextPluginId) => this.options.onNavigatePlugin(nextPluginId),
      onIntent: (intent) => this.dispatch(intent),
      initialPluginId: pluginId,
    });
    this.options.onOpened();
    this.view.render(this.options.getHost());
    window.requestAnimationFrame(() => this.view?.focusContainer());
    void this.refresh(pluginId);
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

  private async refresh(pluginId = this.view?.pluginRoute()): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) return;
    try {
      await this.options.getProtocol().loadScreen({
        schemaVersion: 1,
        viewId: snapshot.viewId,
        screenId: "mcp",
        ...(pluginId ? { preferredEntityId: pluginId } : {}),
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
    if (intent.type === "mcp.set-credential-reference") {
      const secret = this.requireSavedSecret(intent.payload.reference);
      await this.options.getProtocol().synchronizeMcpCredential(
        intent.payload.reference,
        secret,
      );
    } else if (
      intent.type === "mcp.save"
      && intent.payload.draft.authentication === "bearer"
      && intent.payload.draft.bearerCredentialReference
    ) {
      const secret = this.requireSavedSecret(intent.payload.draft.bearerCredentialReference);
      await this.options.getProtocol().synchronizeMcpCredential(
        intent.payload.draft.bearerCredentialReference,
        secret,
      );
    }
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      throw new Error(outcome.notice?.message ?? "The MCP action could not be applied.");
    }
    this.view?.setLocalError(null);
  }

  private requireSavedSecret(reference: string): string {
    const secret = this.options.app.secretStorage.getSecret(reference);
    if (secret) return secret;
    throw new Error(
      `The Obsidian secret “${reference}” has no saved value. Create or update it in Obsidian, then select it here again.`,
    );
  }

  private currentModel(): FrontendPluginMcpScreenViewModel | null {
    return this.options.getStore().snapshot?.screenModels.find(
      (screen): screen is FrontendPluginMcpScreenViewModel =>
        screen.screenId === "mcp" && isPluginMcpScreen(screen),
    ) ?? null;
  }
}

function isPluginMcpScreen(
  screen: FrontendMcpScreenViewModel,
): screen is FrontendPluginMcpScreenViewModel {
  return "installedPlugins" in screen
    && Array.isArray(screen.installedPlugins)
    && "catalogPlugins" in screen
    && Array.isArray(screen.catalogPlugins);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
