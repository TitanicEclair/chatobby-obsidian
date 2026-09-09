import type { App } from "obsidian";
import type {
  FrontendIntentInput,
  FrontendProtocolController,
} from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendChannelScreenViewModel,
  FrontendNavigationReference,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChannelsView } from "../ui/channels-view";

type WorkspaceChannelType = "channel.create" | "channel.send" | "channel.set-participant";
type WorkspaceChannelCommand = { [K in WorkspaceChannelType]: Pick<Extract<FrontendIntentInput, { type: K }>, "type" | "payload"> }[WorkspaceChannelType];

export interface ChannelScreenControllerOptions {
  app: App;
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
      app: this.options.app,
      getModel: () => this.currentModel(),
      subscribe: (listener) => this.options.getStore().subscribeSelector(
        (snapshot) => snapshot.screenModels.find(
          (screen): screen is FrontendChannelScreenViewModel => screen.screenId === "channels",
        ) ?? null,
        listener,
      ),
      onBack: () => this.close(),
      onRefresh: () => this.refresh(),
      onSelectChannel: (id) => this.dispatch("channel.select", { channelId: id }),
      onLoadEarlier: (cursor) => this.dispatch("channel.load-earlier", { cursor }),
      onSetArchived: (id, archived) => this.dispatch("channel.set-archived", { channelId: id, archived }),
      onDeleteChannel: (id) => this.dispatch("channel.delete", { channelId: id }),
      onCreateChannel: (name, description) => this.dispatchWorkspace({ type: "channel.create", payload: { name, description } }),
      onSendMessage: (channelId, text, replyTo, recipientActorIds) => this.dispatchWorkspace({ type: "channel.send", payload: { channelId, text, replyTo, recipientActorIds } }),
      onSetParticipant: (channelId, actorId, action) => this.dispatchWorkspace({ type: "channel.set-participant", payload: { channelId, actorId, action, expectedChannelRevision: this.currentModel()?.revision ?? 0 } }),
      onOpenAgent: (reference) => this.options.openAgentFeed(reference),
      focusMessageId: messageId,
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
    type: "channel.select" | "channel.load-earlier" | "channel.set-archived" | "channel.delete",
    payload: { channelId: string } | { cursor: string } | { channelId: string; archived: boolean },
  ): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
    const base = {
      schemaVersion: 1 as const,
      intentId: crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
    };
    const intent = (type === "channel.select"
      ? { ...base, type, payload: payload as { channelId: string } }
      : type === "channel.load-earlier"
        ? { ...base, type, payload: payload as { cursor: string } }
		: type === "channel.set-archived"
			? {
				...base,
				type,
				payload: {
					...(payload as { channelId: string; archived: boolean }),
					expectedChannelRevision: this.currentModel()?.revision ?? 0,
				},
			}
			: {
				...base,
				type,
				payload: {
					...(payload as { channelId: string }),
					expectedChannelRevision: this.currentModel()?.revision ?? 0,
				},
			}) as FrontendIntentInput;
    const outcome = await this.options.getProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict" || outcome.status === "unavailable") {
      const message = outcome.notice?.message ?? "The channel action could not be applied.";
      this.view?.setLocalError(message);
      throw new Error(message);
    }
    this.view?.setLocalError(null);
  }

  private async dispatchWorkspace(intent: WorkspaceChannelCommand): Promise<void> {
    const snapshot = this.options.getStore().snapshot;
    if (!snapshot) throw new Error("Chatobby is still connecting.");
    const result = await this.options.getProtocol().dispatch({ ...intent, schemaVersion: 1, intentId: crypto.randomUUID(), viewId: snapshot.viewId });
    if (result.status !== "applied" && result.status !== "accepted") throw new Error(result.notice?.message ?? "The channel action could not be completed.");
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
