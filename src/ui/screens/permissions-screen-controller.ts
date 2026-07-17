import type { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../frontend/frontend-store";
import type {
  FrontendIntent,
  FrontendPermissionScreenViewModel,
} from "../../vendor/chatobby-client/frontend-contracts.js";
import { PermissionsView, type PermissionViewIntent } from "../permissions/permissions-view";

export interface PermissionsScreenControllerOptions {
  getHost(): HTMLElement;
  getStore(): FrontendStore;
  getProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(): void;
  onClosed(renderChat: boolean): void;
}

/** Binds the runtime-owned permission screen to its native Obsidian renderer. */
export class PermissionsScreenController {
  private view: PermissionsView | null = null;

  constructor(private readonly options: PermissionsScreenControllerOptions) {}

  handleKeydown(event: KeyboardEvent): boolean {
    return this.view?.handleKeydown(event) ?? false;
  }

  open(): void {
    this.options.prepareOpen();
    this.view?.destroy();
    this.view = new PermissionsView({
      getModel: () => this.currentModel(),
      subscribe: (listener) => this.options.getStore().subscribeSelector(
        (snapshot) => snapshot.screenModels.find(
          (screen): screen is FrontendPermissionScreenViewModel => screen.screenId === "permissions",
        ) ?? null,
        listener,
      ),
      onRefresh: () => this.refresh(),
      onIntent: (intent) => this.dispatch(intent),
      onBack: () => this.close(),
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
    try {
      await this.options.getProtocol().loadScreen({ schemaVersion: 1, viewId: snapshot.viewId, screenId: "permissions" });
      this.view?.setLocalError(null);
    } catch (error) {
      this.view?.setLocalError(errorMessage(error));
    }
  }

  private async dispatch(input: PermissionViewIntent): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
	const model = this.currentModel();
	if (!model) throw new Error("Permission profiles are not loaded");
	const revisionedInput = input.type === "permissions.select-profile"
		? input
		: { ...input, payload: { ...input.payload, expectedProfileRevision: model.profileRevision } };
    const intent = {
      schemaVersion: 1 as const,
      intentId: crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
	  ...revisionedInput,
    } as FrontendIntent;
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      throw new Error(outcome.notice?.message ?? "The permission action could not be applied.");
    }
    this.view?.setLocalError(null);
  }

  private currentModel(): FrontendPermissionScreenViewModel | null {
    return this.options.getStore().snapshot?.screenModels.find(
      (screen): screen is FrontendPermissionScreenViewModel => screen.screenId === "permissions",
    ) ?? null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
