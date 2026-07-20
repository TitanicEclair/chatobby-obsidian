import type { ExtensionPanelAction, ThinkingDisplayMode } from "../../../types";
import type { FeedScrollState } from "../domain/entities";
import type { BlockId, ToolCallId } from "../domain/ids";
import type { FeedDocumentProjection } from "../domain/projections";

export interface ExtensionPanelInput {
  readonly key?: string;
  readonly panelKind: "notice" | "widget" | "screen";
  readonly title: string;
  readonly body: string;
  readonly level?: "info" | "warning" | "error";
  readonly source?: string;
  readonly actions?: readonly ExtensionPanelAction[];
}

export type FeedViewAction =
  | { type: "feed.ui.summary-toggled"; blockId: BlockId; expanded: boolean }
  | { type: "feed.ui.tool-block-toggled"; blockId: BlockId; expanded: boolean }
  | { type: "feed.ui.tool-toggled"; toolCallId: ToolCallId; expanded: boolean }
  | { type: "feed.ui.thinking-display-set"; blockId: BlockId; mode: ThinkingDisplayMode }
  | { type: "feed.ui.scroll-changed"; scroll: FeedScrollState };

/** Complete command surface accepted by a feed store. */
export type FeedAction =
  | { type: "feed.user-prompt-submitted"; text: string; startRun: boolean; submissionId?: string }
  | { type: "feed.user-prompt-retracted"; submissionId: string; text: string }
  | { type: "feed.local-feedback-appended"; input: string; guidance: string }
  | { type: "feed.extension-panel-upserted"; panel: ExtensionPanelInput }
  | { type: "feed.extension-panel-removed"; key: string }
  | { type: "feed.queued-message-appended"; kind: "steer" | "followUp"; text: string }
  | { type: "feed.queued-message-promoted"; kind: "steer" | "followUp"; text: string }
  | { type: "feed.document-projection-synchronized"; projection: FeedDocumentProjection }
  | { type: "feed.runtime-activity-synchronized"; active: boolean }
  | { type: "feed.transport-interrupted" }
  | FeedViewAction;
