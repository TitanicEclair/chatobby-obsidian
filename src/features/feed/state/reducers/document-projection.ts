import type { FeedBlock, ToolBlock, ToolItem, UserMessage } from "../../../../types";
import type { FeedBlockEntity, ToolItemEntity } from "../../domain/entities";
import { assistantCallId, blockId, toolCallId } from "../../domain/ids";
import type { FeedDocumentProjection } from "../../domain/projections";
import type { FeedTransaction } from "../feed-transaction";

/** Reconciles a flat external read model without replacing feed view state or unchanged entities. */
export function reduceDocumentProjection(
  transaction: FeedTransaction,
  projection: FeedDocumentProjection,
): void {
  const projectedIds = projection.blocks.map((block) => blockId(block.id));
  const allBlocks = flattenBlocks(projection.blocks);
  assertUniqueIds(allBlocks.map((block) => blockId(block.id)));
  const pendingLocalIds = transaction.orderedBlockIds().filter((id) => {
    const block = transaction.getBlock(id);
    return block?.type === "user" && block.submissionId !== undefined;
  });
  const unmatchedPendingIds = new Set(pendingLocalIds);

  for (const projected of projection.blocks) {
    if (projected.type !== "user") continue;
    const projectedId = blockId(projected.id);
    const existing = transaction.getBlock(projectedId);
    const projectedText = normalizeUserContent(projected.message.content);
    const pendingId = pendingLocalIds.find((id) => {
      if (!unmatchedPendingIds.has(id)) return false;
      const pending = transaction.getBlock(id);
      return pending?.type === "user" && normalizeUserContent(pending.message.content) === projectedText;
    });
    if (!pendingId || (existing && existing.type === "user" && existing.submissionId === undefined)) continue;
    unmatchedPendingIds.delete(pendingId);
    transaction.consumePendingPromptEcho(projectedText);
  }

  const expectedIds = new Set([
    ...allBlocks.map((block) => blockId(block.id)),
    ...unmatchedPendingIds,
  ]);

  for (const block of allBlocks) reconcileBlock(transaction, block);
  for (const block of allBlocks) {
    if (block.type === "summary") {
      transaction.setSummaryChildren(blockId(block.id), block.blocks.map((child) => blockId(child.id)));
    }
  }
  transaction.replaceOrder([...projectedIds, ...unmatchedPendingIds]);

  const staleIds = transaction.allBlockIds().filter((id) => !expectedIds.has(id));
  for (const id of staleIds.filter((candidate) => transaction.getBlock(candidate)?.type === "summary")) {
    transaction.removeBlock(id);
  }
  for (const id of staleIds.filter((candidate) => transaction.getBlock(candidate)?.type !== "summary")) {
    transaction.removeBlock(id);
  }
}

function normalizeUserContent(content: UserMessage["content"]): string {
  if (typeof content === "string") return normalizeText(content);
  return normalizeText(content.flatMap((item) => {
    if (!isRecord(item) || item.type !== "text" || typeof item.text !== "string") return [];
    return [item.text];
  }).join("\n"));
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function reconcileBlock(transaction: FeedTransaction, block: FeedDocumentProjection["blocks"][number]): void {
  const id = blockId(block.id);
  const entity = toEntity(block);
  const current = transaction.getBlock(id);
  if (current && current.type !== entity.type) transaction.removeBlock(id);
  const retained = transaction.getBlock(id);
  if (!retained) transaction.addBlock(entity);
  else if (!equalUnknown(retained, entity)) transaction.updateBlock(id, () => entity);
  if (block.type === "tools") reconcileTools(transaction, block);
}

function flattenBlocks(blocks: readonly FeedBlock[]): FeedBlock[] {
  const flattened: FeedBlock[] = [];
  for (const block of blocks) {
    flattened.push(block);
    if (block.type === "summary") flattened.push(...flattenBlocks(block.blocks));
  }
  return flattened;
}

function reconcileTools(transaction: FeedTransaction, block: ToolBlock): void {
  const ownerId = blockId(block.id);
  const expectedIds = block.items.map((item) => toolCallId(item.id));
  assertUniqueIds(expectedIds);
  const expected = new Set(expectedIds);
  for (const id of transaction.toolIdsForBlock(ownerId)) {
    if (!expected.has(id)) transaction.removeTool(id);
  }
  for (const item of block.items) {
    const entity = toToolEntity(item);
    const current = transaction.getTool(entity.id);
    if (!current) transaction.addTool(entity, ownerId);
    else if (!equalUnknown(current, entity)) transaction.updateTool(entity.id, () => entity);
  }
  transaction.setToolBlockItems(ownerId, expectedIds);
}

function toEntity(block: FeedDocumentProjection["blocks"][number]): FeedBlockEntity {
  const id = blockId(block.id);
  switch (block.type) {
    case "thinking":
      return {
        type: "thinking",
        id,
        turnId: assistantCallId(block.turnId),
        text: block.text,
        startIndex: block.startIndex,
        endIndex: block.endIndex,
        status: block.status,
        startedAt: block.startedAt,
        durationMs: block.durationMs,
      };
    case "tools":
      return {
        type: "tools",
        id,
        turnId: assistantCallId(block.turnId),
        startIndex: block.startIndex,
        endIndex: block.endIndex,
        status: block.status,
      };
    case "text":
      return {
        type: "text",
        id,
        turnId: assistantCallId(block.turnId),
        text: block.text,
        startIndex: block.startIndex,
        endIndex: block.endIndex,
        status: block.status,
        stopReason: block.stopReason,
        startedAt: block.startedAt,
        durationMs: block.durationMs,
      };
    case "user": return { type: "user", id, messageId: block.messageId, message: block.message };
    case "system": return { type: "system", id, messageId: block.messageId, message: block.message };
    case "queued": return { ...block, id };
    case "divider": return { ...block, id };
    case "subagent": return { ...block, id, activity: block.activity };
    case "subagent-communication": return { ...block, id };
    case "extension-panel": return { ...block, id };
    case "summary":
      return {
        type: "summary",
        id,
        turnId: assistantCallId(block.turnId),
        summaryKind: block.summaryKind,
        startedAt: block.startedAt,
        completedAt: block.completedAt,
        durationMs: block.durationMs,
        text: block.text,
        toolCounts: block.toolCounts,
      };
  }
}

function toToolEntity(item: ToolItem): ToolItemEntity {
  return {
    id: toolCallId(item.id),
    name: item.name,
    category: item.category,
    arguments: item.arguments,
    semanticKind: item.semanticKind,
    displayTitle: item.displayTitle,
    iconToken: item.iconToken,
    status: item.status,
    result: item.result,
    isError: item.isError,
    contentIndex: item.contentIndex,
    startTime: item.startTime,
    endTime: item.endTime,
  };
}

function assertUniqueIds<T extends string>(ids: readonly T[]): void {
  if (new Set(ids).size !== ids.length) throw new Error("Feed projection contains duplicate IDs");
}

function equalUnknown(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => equalUnknown(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(right, key) && equalUnknown(left[key], right[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
