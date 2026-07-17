import type { FeedBlock } from "../../types";
import { feedSelectors, type FeedCommit, type FeedStore } from "../../features/feed/public";
import { STREAM_TEXT_DEBOUNCE_MS } from "../shared/constants";

interface Tickable { tick(): void; }

export function renderKeyForCommit(commit: FeedCommit): { delayMs: number; flush: boolean } | null {
  if (commit.action.type !== "feed.document-projection-synchronized") return null;
  const hasStreamingContent = commit.action.projection.blocks.some((block) =>
    (block.type === "text" || block.type === "thinking" || block.type === "tools") && block.status === "streaming");
  return hasStreamingContent
    ? { delayMs: STREAM_TEXT_DEBOUNCE_MS, flush: false }
    : { delayMs: 0, flush: true };
}

export function hasLiveTiming(store: FeedStore, blocks: readonly FeedBlock[]): boolean {
  if (store.select(feedSelectors.runTiming).runStartedAt != null) return true;
  return blocks.some((block) => {
    if (block.type === "thinking" || block.type === "text") return block.status === "streaming" && block.startedAt != null;
    if (block.type === "tools") return block.items.some((item) => item.status === "running" && item.startTime != null);
    return block.type === "subagent" && block.status === "streaming";
  });
}

export function isTickable(view: unknown): view is Tickable {
  return typeof view === "object" && view !== null && typeof (view as Tickable).tick === "function";
}

const INTERACTIVE_SELECTOR = [
  "button", "a[href]", "input", "select", "textarea", "[role='button']", "[role='menuitem']", ".chatobby-interaction-card",
].join(",");

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}
