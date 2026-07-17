import type { FeedDocumentProjection } from "../features/feed/public";
import type { FeedBlock, ToolItem, ToolItemStatus } from "../types";
import type {
  FrontendFeedBlock,
  FrontendFeedDocumentViewModel,
  FrontendSubagentMessageViewModel as SubagentMessage,
  FrontendToolActivityViewModel,
} from "../vendor/chatobby-client/frontend-contracts.js";

/** Mechanical adapter from runtime meaning to the existing native feed renderer. */
export function toFeedDocumentProjection(document: FrontendFeedDocumentViewModel): FeedDocumentProjection {
  const blocks: FeedBlock[] = [];
  for (const block of document.blocks) blocks.push(...toFeedBlocks(block));
  return { blocks };
}

function toFeedBlocks(block: FrontendFeedBlock): FeedBlock[] {
  switch (block.type) {
    case "user":
    case "system":
      return [{
        type: block.type,
        id: block.id,
        messageId: block.id,
        message: {
          role: "user",
          content: block.images?.length
            ? [
                ...(block.text ? [{ type: "text" as const, text: block.text }] : []),
                ...block.images.map((image) => ({ type: "image" as const, ...image })),
              ]
            : block.text,
          timestamp: block.timestamp ?? Date.now(),
        },
      }];
    case "thinking":
      return [{
        type: "thinking",
        id: block.id,
        turnId: block.turnId ?? block.id,
        text: block.text,
        startIndex: 0,
        endIndex: 0,
        status: block.phase,
        displayMode: null,
        startedAt: block.startedAt,
        durationMs: block.durationMs,
      }];
    case "text":
      return [{
        type: "text",
        id: block.id,
        turnId: block.turnId ?? block.id,
        text: block.text,
        startIndex: 0,
        endIndex: 0,
        status: block.phase,
        startedAt: block.startedAt,
        durationMs: block.durationMs,
      }];
    case "tools":
      return [{
        type: "tools",
        id: block.id,
        turnId: block.turnId ?? block.id,
        items: block.items.map(toToolItem),
        startIndex: 0,
        endIndex: Math.max(0, block.items.length - 1),
        status: block.phase,
        isExpanded: false,
      }];
    case "queued":
      return [{ type: "queued", id: block.id, kind: block.queueKind, text: block.text, status: block.phase }];
    case "compaction":
      return [{
        type: "compaction",
        id: block.id,
        startTime: block.startedAt,
        status: block.phase,
        errorMessage: block.detail,
      }];
    case "agent-activity":
      return [{
        type: "subagent",
        id: block.id,
        agentId: block.actorId,
        status: block.phase === "completed" || block.phase === "failed" ? "complete" : "streaming",
        activity: {
          agentId: block.actorId,
          name: block.title,
          type: "Agent",
          description: block.detail ?? block.title,
          source: "chatobby-supervisor",
          status: block.phase === "created" ? "created" : block.phase,
          compactionCount: 0,
        },
      }];
    case "notice":
      return [{
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
      }];
    case "message":
      return [{
        type: "subagent-communication",
        id: block.id,
        messageId: block.id,
        message: toSubagentMessage(block),
      }];
    case "summary":
      return [{
        type: "summary",
        id: block.id,
        turnId: block.id,
        summaryKind: "run",
        durationMs: block.durationMs,
        text: block.text,
        toolCounts: { ...block.toolCounts },
        isExpanded: false,
        blocks: block.blocks.flatMap(toFeedBlocks),
      }];
  }
}

function toSubagentMessage(block: Extract<FrontendFeedBlock, { type: "message" }>): SubagentMessage {
  const runId = block.navigation?.runId ?? block.id;
  const senderIsAgent = block.navigation?.nodeId !== undefined;
  return {
    id: block.id,
    runId,
    nodeId: block.navigation?.nodeId,
    threadId: runId,
    from: {
      kind: senderIsAgent ? "agent" : "parent",
      id: block.navigation?.nodeId ?? block.navigation?.mainSessionId ?? "main",
      label: block.senderLabel,
    },
    to: [{ kind: "agent", id: "recipient", label: block.recipientLabel }],
    kind: "inform",
    text: block.text,
    blocking: false,
    status: "delivered",
    createdAt: block.timestamp,
  };
}

function toToolItem(item: FrontendToolActivityViewModel): ToolItem {
  return {
    id: item.id,
    name: item.semanticKind,
    semanticKind: item.semanticKind,
    displayTitle: item.title,
    iconToken: item.iconToken,
    category: item.category,
    arguments: item.detail ?? "",
    status: toToolStatus(item.phase),
    result: item.resultSummary,
    isError: item.phase === "failed",
    isExpanded: false,
    startTime: item.startedAt,
    endTime: item.completedAt,
  };
}

function toToolStatus(phase: FrontendToolActivityViewModel["phase"]): ToolItemStatus {
  if (phase === "queued") return "pending";
  return phase;
}
