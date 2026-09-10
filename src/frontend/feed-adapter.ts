import type { FeedDocumentProjection } from "../features/feed/public";
import type { FeedBlock, ToolItem, ToolItemStatus } from "../types";
import type {
  FrontendFeedBlock,
  FrontendFeedDocumentViewModel,
  FrontendSubagentMessageViewModel as SubagentMessage,
  FrontendToolActivityViewModel,
} from "../vendor/chatobby-client/frontend-contracts.js";

/** Mechanical adapter from runtime meaning to the existing native feed renderer. */
export function toFeedDocumentProjection(
  document: FrontendFeedDocumentViewModel,
): FeedDocumentProjection {
  const blocks: FeedBlock[] = [];
  for (const block of document.blocks) blocks.push(...toFeedBlocks(block));
  return { blocks };
}

// Runtime patch application preserves unchanged block objects. Weak keys keep
// closed conversations collectible while avoiding repeated history conversion.
const blockProjections = new WeakMap<FrontendFeedBlock, FeedBlock[]>();

function toFeedBlocks(block: FrontendFeedBlock): FeedBlock[] {
  const existing = blockProjections.get(block);
  if (existing) return existing;
  const projection = projectFeedBlock(block);
  blockProjections.set(block, projection);
  return projection;
}

function projectFeedBlock(block: FrontendFeedBlock): FeedBlock[] {
  switch (block.type) {
    case "user":
    case "system": {
      const attachments = block.attachments?.length
        ? block.attachments.map((attachment) => ({
            type: "attachment" as const,
            ...attachment,
          }))
        : block.images?.map((image, index) => ({
            type: "attachment" as const,
            name: `Attached image ${index + 1}`,
            kind: "image" as const,
            ...image,
          }));
      return [
        {
          type: block.type,
          id: block.id,
          messageId: block.id,
          message: {
            role: "user",
            skillInvocations: block.skillInvocations,
            content: attachments?.length
              ? [
                  ...(block.text
                    ? [{ type: "text" as const, text: block.text }]
                    : []),
                  ...attachments,
                ]
              : block.text,
            timestamp: block.timestamp,
          },
        },
      ];
    }
    case "thinking":
      return [
        {
          type: "thinking",
          id: block.id,
          turnId: block.turnId,
          text: block.text,
          startIndex: 0,
          endIndex: 0,
          status: block.phase,
          displayMode: null,
          startedAt: block.startedAt,
          durationMs: block.durationMs,
        },
      ];
    case "text":
      return [
        {
          type: "text",
          id: block.id,
          turnId: block.turnId,
          text: block.text,
          startIndex: 0,
          endIndex: 0,
          status: block.phase,
          startedAt: block.startedAt,
          durationMs: block.durationMs,
        },
      ];
    case "tools":
      return [
        {
          type: "tools",
          id: block.id,
          turnId: block.turnId,
          items: block.items.map(toToolItem),
          startIndex: 0,
          endIndex: Math.max(0, block.items.length - 1),
          status: block.phase,
          isExpanded: false,
        },
      ];
    case "queued":
      return [
        {
          type: "queued",
          id: block.id,
          kind: block.queueKind,
          text: block.text,
          status: block.phase,
        },
      ];
    case "divider":
      return [
        {
          type: "divider",
          id: block.id,
          label: block.label,
          tone: block.tone,
          animated: block.animated,
          activityStartedAt: block.activityStartedAt,
          activityEndedAt: block.activityEndedAt,
          activityLabel: block.activityLabel,
          detail: block.detail,
          activitySteps: block.activitySteps,
        },
      ];
    case "agent-activity":
      return [
        {
          type: "subagent",
          id: block.id,
          agentId: block.nodeId ?? block.actorId,
          status:
            block.phase === "completed" || block.phase === "failed"
              ? "complete"
              : "streaming",
          activity: {
            agentId: block.nodeId ?? block.actorId,
            name: block.title,
            type: "Agent",
            description: block.detail ?? block.title,
            source: "chatobby-supervisor",
            status: block.phase === "created" ? "created" : block.phase,
            compactionCount: block.compactionCount,
          },
        },
      ];
    case "notice":
      return [
        {
          type: "extension-panel",
          id: block.id,
          key: block.id,
          panelKind: "notice",
          title: block.title,
          body: block.body,
          level: block.level,
          actions: block.actions.map((action) => ({
            id: action.id,
            label: action.label,
            icon: action.iconToken,
            kind: action.kind,
          })),
          createdAt: block.createdAt,
        },
      ];
    case "message":
      return [
        {
          type: "subagent-communication",
          id: block.id,
          messageId: block.id,
          message: toSubagentMessage(block),
        },
      ];
    case "summary":
      return [
        {
          type: "summary",
          id: block.id,
          turnId: block.id,
          summaryKind: "run",
          durationMs: block.durationMs,
          text: block.text,
          toolCounts: { ...block.toolCounts },
          isExpanded: false,
          blocks: block.blocks.flatMap(toFeedBlocks),
        },
      ];
  }
}

function toSubagentMessage(
  block: Extract<FrontendFeedBlock, { type: "message" }>,
): SubagentMessage {
  return block.message;
}

function toToolItem(item: FrontendToolActivityViewModel): ToolItem {
  return {
    id: item.id,
    name: item.semanticKind,
    semanticKind: item.semanticKind,
    displayTitle: item.title,
    iconToken: item.iconToken,
    category: item.category === "bash" ? "shell" : item.category,
    arguments: item.detail ?? "",
    status: toToolStatus(item.phase),
    result: item.resultSummary,
    isError: item.phase === "failed",
    isExpanded: false,
    startTime: item.startedAt,
    endTime: item.completedAt,
  };
}

function toToolStatus(
  phase: FrontendToolActivityViewModel["phase"],
): ToolItemStatus {
  if (phase === "queued") return "pending";
  return phase;
}
