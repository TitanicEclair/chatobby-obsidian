import { Notice } from "obsidian";
import type { FrontendIntentInput, FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../frontend/frontend-store";
import type {
  FrontendIntentResult,
  FrontendPermissionScreenViewModel,
} from "../../vendor/chatobby-client/frontend-contracts.js";
import { PermissionsView, type PermissionViewIntent } from "../permissions/permissions-view";
import { nativeSetupIntentIsCurrent } from "../permissions/native-setup-view";

export interface PermissionsScreenControllerOptions {
  workspacePage?: boolean;
  onManageTools?(): void;
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
      workspacePage: this.options.workspacePage,
      onManageTools: () => this.options.onManageTools?.(),
      getModel: () => this.currentModel(),
      getActiveSessionId: () => this.options.getStore().snapshot?.session?.id ?? null,
      supportsObsidianVaultAccess: () => this.options.getProtocol().supportsCapability("obsidian-vault-access"),
      supportsNativeSetup: () => this.options.getProtocol().supportsCapability("native-sandbox-setup"),
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
    const view = this.view;
    const model = this.currentModel();
    const isCurrent = () => {
      const current = this.options.getStore().snapshot;
      return this.view === view && current?.runtimeInstanceId === snapshot.runtimeInstanceId
        && current.viewId === snapshot.viewId && current.session?.id === snapshot.session?.id;
    };
    try {
      const loaded = await this.options.getProtocol().loadScreen({ schemaVersion: 1, viewId: snapshot.viewId, screenId: "permissions" });
      if (isCurrent() && (this.currentModel() === model || this.currentModel() === loaded)) view?.setLocalError(null);
    } catch (error) {
      if (isCurrent() && this.currentModel() === model) view?.setLocalError(errorMessage(error));
    }
  }

  private async dispatch(input: PermissionViewIntent): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
    const view = this.view;
    const isCurrentPolicyTarget = () => {
      const current = this.options.getStore().snapshot;
      return this.view === view && current?.runtimeInstanceId === snapshot.runtimeInstanceId
        && current.viewId === snapshot.viewId && current.session?.id === snapshot.session?.id;
    };
    if (input.type === "permissions.set-access-policy") {
      const model = this.currentModel();
      if (!snapshot.session || input.mainSessionId !== snapshot.session.id
        || model?.loading || model?.accessPolicySessionId !== snapshot.session.id
        || model.accessPolicy.revision !== input.payload.expectedRevision)
        throw new Error("The active chat or its access policy changed. Reload permissions before trying again.");
    }
    if (input.type === "permissions.setup-native-sandbox" || input.type === "permissions.revoke-native-sandbox"
      || input.type === "permissions.verify-native-sandbox") {
      if (!this.options.getProtocol().supportsCapability("native-sandbox-setup"))
        throw new Error("Native setup controls are unavailable on this runtime connection.");
      if (snapshot.session?.id !== input.payload.expectedSessionId || !nativeSetupIntentIsCurrent(this.currentModel(), input))
        throw new Error("The native setup target changed. Reload and review the exact grants or installed verification again.");
    }
    if ((input.type === "permissions.set-obsidian-vault-access" || input.type === "permissions.set-workspace-vault-access")
      && !this.options.getProtocol().supportsCapability("obsidian-vault-access")) {
      throw new Error("Obsidian vault-access controls are unavailable on this runtime connection.");
    }
    if (input.type === "permissions.set-obsidian-vault-access"
      && snapshot.session?.id !== input.payload.expectedSessionId) {
      throw new Error("The active chat changed. Reload permissions before trying again.");
    }
    const intent: FrontendIntentInput = {
      schemaVersion: 1 as const,
      intentId: crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
      ...input,
    };
    let outcome: FrontendIntentResult;
    try {
      outcome = await this.options.getProtocol().dispatch(intent);
    } catch (error) {
      if (input.type === "permissions.set-access-policy" && !isCurrentPolicyTarget()) return;
      throw error;
    }
    if (input.type === "permissions.set-access-policy" && !isCurrentPolicyTarget()) return;
    if (outcome.status === "rejected" || outcome.status === "conflict" || outcome.status === "unavailable") {
      throw new Error(outcome.notice?.message ?? "The permission action could not be applied.");
    }
    if (input.type === "permissions.set-access-policy" && outcome.notice) new Notice(outcome.notice.message);
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
