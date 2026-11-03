import { PermissionRequestCard, permissionRequestDisplay, notifyPermissionRequestOnce } from "../../features/permissions/public";
import type { InteractionState, WsExtensionUIRequest } from "../../types";
import { createInteractionState } from "../../types";
import type { FeedStore } from "../../features/feed/public";
import type { FeedRenderer } from "../feed";
import type { InteractionCard } from "../feed/interaction-card";
import { ConfirmCard } from "../feed/confirm-card";
import { EditorCard } from "../feed/editor-card";
import { InputCard } from "../feed/input-card";
import { SelectCard } from "../feed/select-card";
import { extensionNoticeSource, extensionNoticeTitle, extensionPanelLevel, isBlockingInteraction, shouldSuppressExtensionNotice, titleCase } from "./view-utils";

/** Capability surface used by extension UI requests. */
export interface ExtensionUiControllerOptions {
  getFeedStore: () => FeedStore;
  getFeedRenderer: () => FeedRenderer | null;
  getPermissionRequestHost?: () => HTMLElement | null;
  getCancelKeybinding?: () => string;
  setComposerText: (text: string) => void;
  focusComposer: () => void;
  getActiveInteraction: () => InteractionState | null;
  setActiveInteraction: (interaction: InteractionState | null) => void;
}

/** Routes extension UI requests and owns the lifecycle of blocking interaction cards. */
export class ExtensionUiController {
  private activeCard: InteractionCard | null = null;
  private activeRequestId: string | null = null;
  private readonly pending = new Map<string, (result: unknown) => void>();
  private readonly queuedRequests: WsExtensionUIRequest[] = [];
  private readonly completedPermissionRequests = new Set<string>();
  private readonly permissionIds = new Map<string, string>();

  constructor(private readonly options: ExtensionUiControllerOptions) {}

  async handle(request: WsExtensionUIRequest): Promise<unknown> {
    switch (request.method) {
      case "dismiss": this.dismiss(request.id); return undefined;
      case "notify": this.appendNotice(request.params); return undefined;
      case "setTitle": document.title = typeof request.params.title === "string" ? request.params.title : "Chatobby"; return undefined;
      case "setWidget": this.updateWidget(request.params); return undefined;
      case "select":
      case "confirm":
      case "input":
      case "editor": return this.showInteraction(request);
      default: return undefined;
    }
  }

  isActive(): boolean {
    return this.activeCard !== null;
  }

  handleKeydown(event: KeyboardEvent): boolean {
    return this.activeCard?.handleKeydown(event) ?? false;
  }

  updateText(text: string): void {
    this.activeCard?.setLiveText(text);
  }

  submit(): void {
    if (this.activeCard instanceof InputCard || this.activeCard instanceof EditorCard) this.activeCard.submit();
  }

  /** Remove a stale durable projection without turning navigation into an approval or denial. */
  dismiss(id: string): void { this.finish(id, undefined); }

  /** A durable request remains reviewable when its decision was not accepted by the runtime. */
  allowPermissionRequestRetry(requestId: string): void { this.completedPermissionRequests.delete(requestId); }

	cancelActive(): void {
		this.activeCard?.cancel();
	}

	/** Cancel the active interaction and every queued request without mounting another card. */
	cancelAll(): void {
		for (const resolve of this.pending.values()) resolve(undefined);
		this.pending.clear();
		this.permissionIds.clear();
		this.queuedRequests.length = 0;
		this.activeCard?.destroy();
		this.activeCard = null;
		this.activeRequestId = null;
		this.options.setActiveInteraction(null);
		this.options.getFeedRenderer()?.clearInteraction();
    this.clearPermissionHost();
	}

	dispose(): void {
		this.cancelAll();
	}

  private showInteraction(request: WsExtensionUIRequest): Promise<unknown> {
    if (!isBlockingInteraction(request.method) || this.pending.has(request.id)) return Promise.resolve(undefined);
    const permission = permissionRequestDisplay(request.params);
    if (request.params.permissionRequest !== undefined && (request.method !== "confirm" || !permission)) return Promise.resolve(false);
    if (permission) {
      if (this.completedPermissionRequests.has(permission.requestId) || [...this.permissionIds.values()].includes(permission.requestId)) return Promise.resolve(undefined);
      this.permissionIds.set(request.id, permission.requestId);
      notifyPermissionRequestOnce(permission);
    }
    return new Promise((resolve) => {
      this.pending.set(request.id, resolve);
      this.queuedRequests.push(request);
      this.mountNextInteraction();
    });
  }

  private mountNextInteraction(): void {
    if (this.activeCard) return;
    const request = this.queuedRequests.shift();
    if (!request || !isBlockingInteraction(request.method)) return;
    const interaction = createInteractionState(request.id, request.method, request.params);
    this.options.setActiveInteraction(interaction);
    const permission = permissionRequestDisplay(request.params);
    if (!permission) this.options.setComposerText(interaction.text);
    const card = this.createCard(request.method, permission !== null);
    this.activeCard = card;
    this.activeRequestId = request.id;
    const permissionHost = permission ? this.options.getPermissionRequestHost?.() : null;
    if (permissionHost) { permissionHost.removeClass("is-hidden"); card.render(permissionHost); }
    else this.options.getFeedRenderer()?.mountInteraction(card);
    card.setState(interaction);
    if (interaction.method === "input") this.options.focusComposer();
  }

  private createCard(method: InteractionState["method"], permission = false): InteractionCard {
    const host = {
      getActiveInteraction: () => this.options.getActiveInteraction(),
      respond: (id: string, result: unknown) => this.finish(id, result),
      cancel: (id: string) => this.finish(id, undefined),
    };
    if (permission) return new PermissionRequestCard(host, this.options.getCancelKeybinding);
    if (method === "select") return new SelectCard(host);
    if (method === "confirm") return new ConfirmCard(host);
    if (method === "input") return new InputCard(host);
    return new EditorCard(host);
  }

  private finish(id: string, result: unknown): void {
    const resolve = this.pending.get(id);
    if (!resolve) return;
    const permissionId = this.permissionIds.get(id);
    this.permissionIds.delete(id);
    if (permissionId && typeof result === "boolean") {
      this.completedPermissionRequests.add(permissionId);
      if (this.completedPermissionRequests.size > 256) { const oldest = [...this.completedPermissionRequests][0]; if (oldest) this.completedPermissionRequests.delete(oldest); }
    }
    resolve(result);
    this.pending.delete(id);
    if (this.activeRequestId !== id) {
      const queuedIndex = this.queuedRequests.findIndex((request) => request.id === id);
      if (queuedIndex >= 0) this.queuedRequests.splice(queuedIndex, 1);
      return;
    }
    const permission = this.activeCard instanceof PermissionRequestCard;
    this.activeCard?.destroy();
    this.activeCard = null;
    this.activeRequestId = null;
    this.options.setActiveInteraction(null);
    this.options.getFeedRenderer()?.clearInteraction();
    this.clearPermissionHost();
    if (!permission) this.options.setComposerText("");
    this.mountNextInteraction();
  }

  private clearPermissionHost(): void {
    const host = this.options.getPermissionRequestHost?.();
    host?.empty();
    host?.addClass("is-hidden");
  }

  private appendNotice(params: Record<string, unknown>): void {
    const message = typeof params.message === "string" ? params.message : "Chatobby notification";
    if (shouldSuppressExtensionNotice(message)) return;
    const level = extensionPanelLevel(params.notifyType);
    this.options.getFeedStore().dispatch({
      type: "feed.extension-panel-upserted",
      panel: { panelKind: "notice", title: extensionNoticeTitle(message, level), body: message, level, source: extensionNoticeSource(message) },
    });
  }

  private updateWidget(params: Record<string, unknown>): void {
    const key = typeof params.widgetKey === "string" ? params.widgetKey : "widget";
    const lines = Array.isArray(params.widgetLines) ? params.widgetLines.filter((line): line is string => typeof line === "string") : [];
    if (lines.length === 0) {
      this.options.getFeedStore().dispatch({ type: "feed.extension-panel-removed", key: `widget:${key}` });
      return;
    }
    this.options.getFeedStore().dispatch({
      type: "feed.extension-panel-upserted",
      panel: { key: `widget:${key}`, panelKind: "widget", title: `${titleCase(key)} widget`, body: lines.join("\n"), level: "info", source: key },
    });
  }
}
