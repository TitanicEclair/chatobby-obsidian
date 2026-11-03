import { Notice } from "obsidian";
import { createFeedStore } from "../../feed/public";
import type { InteractionState } from "../../../types";
import { ExtensionUiController } from "../../../ui/controller/extension-ui-controller";
import { ProjectedPermissionRequests } from "../../permissions/public";
import type { FrontendSubagentPermissionRequestViewModel } from "../../../vendor/chatobby-client/frontend-contracts";
import type { SubagentScreenActions } from "../domain/screen-model";

/** Adapts the selected child's durable request to the same composer review used by its parent. */
export class SubagentPermissionComposer {
  private interaction: InteractionState | null = null;
  private readonly ui: ExtensionUiController;
  private readonly projected: ProjectedPermissionRequests;

  constructor(getHost: () => HTMLElement | null, private readonly actions: SubagentScreenActions) {
    this.ui = new ExtensionUiController({ getFeedStore: createFeedStore, getFeedRenderer: () => null,
      getPermissionRequestHost: getHost, getCancelKeybinding: actions.getCancelKeybinding,
      getActiveInteraction: () => this.interaction, setActiveInteraction: (value) => { this.interaction = value; },
      setComposerText: () => {}, focusComposer: () => {} });
    this.projected = new ProjectedPermissionRequests(this.ui, (error) => { new Notice(error instanceof Error ? error.message : "The request could not be updated."); });
  }

  update(binding: string, runId?: string, nodeId?: string, permission?: FrontendSubagentPermissionRequestViewModel): void {
    this.projected.update(binding, runId && nodeId && permission?.status === "pending" && permission.permissionRequest && permission.kind === "confirm"
      ? [{ key: `${runId}:${nodeId}:${permission.id}:${permission.revision}`, review: permission.permissionRequest,
          decide: (approved) => this.actions.decidePermission(runId, nodeId, permission.id, permission.revision, approved) }]
      : []);
  }

  handleKeydown(event: KeyboardEvent): boolean { return this.ui.handleKeydown(event); }
  destroy(): void { this.projected.clear(); this.ui.dispose(); }
}
