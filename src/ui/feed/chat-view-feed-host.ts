import { MarkdownRenderer, type App, type Component } from "obsidian";
import type { FeedStore } from "../../features/feed/public";
import type { ExtensionPanelAction, ThinkingDisplay } from "../../types";
import type { FeedHost } from "./index";
import { createFeedHost } from "./feed-host";

export type ChatViewFeedOwner = Component & {
  readonly app: App;
  feedAutoScroll(): boolean;
  feedThinkingDisplay(): ThinkingDisplay;
  scrollFeed(): void;
  openVaultLink(path: string): void;
  openSystemPath(path: string): void;
  copyToClipboard(text: string): void;
  handleExtensionPanelAction(action: ExtensionPanelAction): void;
  onAutoScrollChange(enabled: boolean): void;
  onCompactionRequest(): void;
  setComposerText(text: string): void;
  focusComposer(): void;
};

/** Compose the main and subagent renderer host from the view's narrow public actions. */
export function createChatViewFeedHost(
  owner: ChatViewFeedOwner,
  getFeedStore: () => FeedStore,
): FeedHost {
  return createFeedHost({
    app: owner.app,
    component: owner,
    getFeedStore,
    getAutoScroll: () => owner.feedAutoScroll(),
    getThinkingDisplay: () => owner.feedThinkingDisplay(),
    renderMarkdown: (markdown, container) => MarkdownRenderer.render(owner.app, markdown, container, "", owner),
    scrollFeed: () => owner.scrollFeed(),
    openVaultLink: (path) => owner.openVaultLink(path),
    openSystemPath: (path) => owner.openSystemPath(path),
    copyToClipboard: (text) => owner.copyToClipboard(text),
    onExtensionPanelAction: (action) => owner.handleExtensionPanelAction(action),
    onAutoScrollChange: (enabled) => owner.onAutoScrollChange(enabled),
    onCompactionRequest: () => owner.onCompactionRequest(),
    onEmptyPrompt: (prompt) => {
      owner.setComposerText(prompt);
      window.requestAnimationFrame(() => owner.focusComposer());
    },
    onFeedEscape: () => window.requestAnimationFrame(() => owner.focusComposer()),
  });
}
