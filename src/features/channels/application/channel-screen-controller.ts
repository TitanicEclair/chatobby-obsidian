import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendChannelScreenViewModel,
  FrontendIntent,
  FrontendNavigationReference,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChannelsView } from "../ui/channels-view";

export interface ChannelScreenControllerOptions {
  getHost(): HTMLElement;
  getStore(): FrontendStore;
  getProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(): void;
  onClosed(renderChat: boolean): void;
  openAgentFeed(reference: FrontendNavigationReference): Promise<void>;
}

/** Binds the runtime-owned channel screen model to native Obsidian rendering. */
export class ChannelScreenController {
  private view: ChannelsView | null = null;
  private preferredChannelId: string | undefined;

  constructor(private readonly options: ChannelScreenControllerOptions) {}

  open(channelId?: string, messageId?: string): void {
    this.preferredChannelId = channelId;
    this.options.prepareOpen();
    this.view?.destroy();
    this.view = new ChannelsView({
      getModel: () => this.currentModel(),
      subscribe: (listener) => this.options.getStore().subscribe(() => listener(this.currentModel())),
      onBack: () => this.close(),
      onRefresh: () => this.refresh(),
      onSelectChannel: (id) => this.dispatch("channel.select", { channelId: id }),
      onLoadEarlier: (cursor) => this.dispatch("channel.load-earlier", { cursor }),
      onSetArchived: (id, archived) => this.dispatch("channel.set-archived", { channelId: id, archived }),
      onOpenAgent: (reference) => this.options.openAgentFeed(reference),
      focusMessageId: messageId,
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
      await this.options.getProtocol().loadScreen({
        schemaVersion: 1,
        viewId: snapshot.viewId,
        screenId: "channels",
        preferredEntityId: this.preferredChannelId,
      });
      this.preferredChannelId = undefined;
      this.view?.setLocalError(null);
    } catch (error) {
      this.view?.setLocalError(errorMessage(error));
    }
  }

  private async dispatch(
    type: "channel.select" | "channel.load-earlier" | "channel.set-archived",
    payload: { channelId: string } | { cursor: string } | { channelId: string; archived: boolean },
  ): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
    const base = {
      schemaVersion: 1 as const,
      intentId: crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
      expectedRevision: snapshot.revision,
    };
    const intent: FrontendIntent = type === "channel.select"
      ? { ...base, type, payload: payload as { channelId: string } }
      : type === "channel.load-earlier"
        ? { ...base, type, payload: payload as { cursor: string } }
        : { ...base, type, payload: payload as { channelId: string; archived: boolean } };
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      const message = outcome.notice?.message ?? "The channel action could not be applied.";
      this.view?.setLocalError(message);
      throw new Error(message);
    }
    this.view?.setLocalError(null);
  }

  private currentModel(): FrontendChannelScreenViewModel | null {
    return this.options.getStore().snapshot?.screenModels.find(
      (screen): screen is FrontendChannelScreenViewModel => screen.screenId === "channels",
    ) ?? null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
