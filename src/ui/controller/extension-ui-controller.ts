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
  setComposerText: (text: string) => void;
  getActiveInteraction: () => InteractionState | null;
  setActiveInteraction: (interaction: InteractionState | null) => void;
}

/** Routes extension UI requests and owns the lifecycle of blocking interaction cards. */
export class ExtensionUiController {
  private activeCard: InteractionCard | null = null;
  private activeRequestId: string | null = null;
  private readonly pending = new Map<string, (result: unknown) => void>();
  private readonly queuedRequests: WsExtensionUIRequest[] = [];

  constructor(private readonly options: ExtensionUiControllerOptions) {}

  async handle(request: WsExtensionUIRequest): Promise<unknown> {
    switch (request.method) {
      case "notify": this.appendNotice(request.params); return undefined;
      case "setTitle": document.title = String(request.params.title ?? "Chatobby"); return undefined;
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

  cancelActive(): void {
    this.activeCard?.cancel();
  }

  dispose(): void {
    for (const resolve of this.pending.values()) resolve(undefined);
    this.pending.clear();
    this.queuedRequests.length = 0;
    this.activeCard = null;
    this.activeRequestId = null;
    this.options.setActiveInteraction(null);
    this.options.getFeedRenderer()?.clearInteraction();
  }

  private showInteraction(request: WsExtensionUIRequest): Promise<unknown> {
    if (!isBlockingInteraction(request.method)) return Promise.resolve(undefined);
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
    this.options.setComposerText("");
    const card = this.createCard(request.method);
    this.activeCard = card;
    this.activeRequestId = request.id;
    this.options.getFeedRenderer()?.mountInteraction(card);
    card.setState(interaction);
  }

  private createCard(method: InteractionState["method"]): InteractionCard {
    const host = {
      getActiveInteraction: () => this.options.getActiveInteraction(),
      respond: (id: string, result: unknown) => this.finish(id, result),
      cancel: (id: string) => this.finish(id, undefined),
    };
    if (method === "select") return new SelectCard(host);
    if (method === "confirm") return new ConfirmCard(host);
    if (method === "input") return new InputCard(host);
    return new EditorCard(host);
  }

  private finish(id: string, result: unknown): void {
    const resolve = this.pending.get(id);
    if (!resolve) return;
    resolve(result);
    this.pending.delete(id);
    if (this.activeRequestId !== id) {
      const queuedIndex = this.queuedRequests.findIndex((request) => request.id === id);
      if (queuedIndex >= 0) this.queuedRequests.splice(queuedIndex, 1);
      return;
    }
    this.activeCard = null;
    this.activeRequestId = null;
    this.options.setActiveInteraction(null);
    this.options.getFeedRenderer()?.clearInteraction();
    this.options.setComposerText("");
    this.mountNextInteraction();
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
