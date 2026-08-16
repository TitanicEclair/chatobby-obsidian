import type { FeedBlock } from "../../types";
import { chatobbyPerformance } from "../../frontend/performance-monitor";
import {
  blockId,
  feedSelectors,
  type FeedCommit,
  type FeedStore,
} from "../../features/feed/public";

interface WorkingStatusState {
  readonly active: boolean;
  readonly hasInteraction: boolean;
  readonly compacting: boolean;
}

/** Owns the quiet gap between submission and the next visible provider event. */
export class WorkingStatusController {
  private element: HTMLElement | null = null;
  private firstOutputWaitStartedAt: number | null = null;

  mount(container: HTMLElement): void {
    this.element = container.createDiv({
      cls: "chatobby-feed__working is-hidden",
      attr: { role: "status", "aria-live": "polite" },
    });
    this.element.createSpan({
      cls: "chatobby-visually-hidden",
      text: "Chatobby is working",
    });
    this.element.createSpan({
      cls: "chatobby-feed__working-label",
      text: "Working",
      attr: { "aria-hidden": "true" },
    });
    const dots = this.element.createSpan({
      cls: "chatobby-feed__working-dots",
      attr: { "aria-hidden": "true" },
    });
    for (let index = 0; index < 3; index += 1) dots.createSpan({ text: "." });
  }

  clear(): void {
    this.element = null;
    this.firstOutputWaitStartedAt = null;
  }

  sync(store: FeedStore, blocks: readonly FeedBlock[], state: WorkingStatusState): void {
    if (!this.element) return;
    const hasVisibleActivity = blocks.some((block) => {
      if (block.type === "thinking" || block.type === "text") return block.status === "streaming";
      if (block.type === "tools") {
        return block.status === "streaming"
          || block.items.some((item) =>
            item.status === "pending" || item.status === "running" || item.status === "waiting");
      }
      return block.type === "subagent" && block.status === "streaming";
    });
    const waiting = state.active
      && store.select(feedSelectors.runTiming).runStartedAt != null
      && !hasVisibleActivity
      && !state.hasInteraction
      && !state.compacting;
    this.element.toggleClass("is-hidden", !waiting);
  }

  observeFirstOutput(commit: FeedCommit, store: FeedStore): void {
    if (commit.action.type === "feed.user-prompt-submitted" && commit.action.startRun) {
      this.firstOutputWaitStartedAt =
        store.select(feedSelectors.runTiming).runStartedAt ?? Date.now();
      return;
    }
    if (this.firstOutputWaitStartedAt == null) return;
    const firstOutput = [
      ...commit.changes.addedBlockIds,
      ...commit.changes.updatedBlockIds,
    ]
      .map((id) => store.select(feedSelectors.blockById(blockId(id))))
      .some((block) =>
        block?.type === "thinking" || block?.type === "text" || block?.type === "tools");
    if (firstOutput) {
      chatobbyPerformance.recordFirstOutputLatency(
        Date.now() - this.firstOutputWaitStartedAt,
      );
      this.firstOutputWaitStartedAt = null;
      return;
    }
    if (
      commit.action.type === "feed.user-prompt-retracted"
      || commit.action.type === "feed.transport-interrupted"
    ) {
      this.firstOutputWaitStartedAt = null;
    }
  }
}
