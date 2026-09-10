import type { FeedBlock, ToolBlock, ToolItem, UserMessage } from "../../../../types";
import type { FeedBlockEntity, ToolItemEntity } from "../../domain/entities";
import { assistantCallId, blockId, toolCallId } from "../../domain/ids";
import type { FeedDocumentProjection } from "../../domain/projections";
import type { FeedTransaction } from "../feed-transaction";

// Wire projections replace changed objects. Retain conversion identity for
// unchanged history so a text delta does not deep-compare every old tool result.
const blockEntities = new WeakMap<FeedBlock, FeedBlockEntity>();
const toolEntities = new WeakMap<ToolItem, ToolItemEntity>();

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
    if (!unmatchedPendingIds.size) break;
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
    const promptText = normalizeUserText(projected.message.content);
    if (promptText) transaction.consumePendingPromptEcho(promptText);
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
    removeBlockFromProjection(transaction, id);
  }
  for (const id of staleIds.filter((candidate) => transaction.getBlock(candidate)?.type !== "summary")) {
    removeBlockFromProjection(transaction, id);
  }
}

function normalizeUserText(content: UserMessage["content"]): string {
  if (typeof content === "string") return normalizeText(content);
  return content
    .filter((item): item is Extract<typeof item, { type: "text" }> => item.type === "text")
    .map((item) => normalizeText(item.text))
    .filter(Boolean)
    .join("\n");
}

function normalizeUserContent(content: UserMessage["content"]): string {
  if (typeof content === "string") return normalizeText(content);
  return content.map((item) => {
    if (!isRecord(item)) return "";
    if (item.type === "text" && typeof item.text === "string") return normalizeText(item.text);
    if (item.type === "image" && typeof item.data === "string") {
      return `image:${typeof item.mimeType === "string" ? item.mimeType : ""}:${item.data.length}:${item.data.slice(0, 24)}`;
    }
    if (item.type !== "attachment" || typeof item.name !== "string") return "";
    return [
      "attachment",
      item.name,
      typeof item.kind === "string" ? item.kind : "",
      typeof item.mimeType === "string" ? item.mimeType : "",
      typeof item.path === "string" ? item.path : "",
      typeof item.sizeBytes === "number" ? String(item.sizeBytes) : "",
    ].join(":");
  }).filter(Boolean).join("\n");
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function reconcileBlock(transaction: FeedTransaction, block: FeedDocumentProjection["blocks"][number]): void {
  const id = blockId(block.id);
  const entity = toEntity(block);
  const current = transaction.getBlock(id);
  if (current && current.type !== entity.type) removeBlockFromProjection(transaction, id);
  const retained = transaction.getBlock(id);
  if (!retained) transaction.addBlock(entity);
  else if (!equalUnknown(retained, entity)) transaction.updateBlock(id, () => entity);
  if (block.type === "tools") reconcileTools(transaction, block);
}

/**
 * Detach a block from summaries before replacing or removing it.
 *
 * Runtime history IDs are positional. Compaction can therefore reuse an ID for
 * a different block type while an older summary still owns that ID in the
 * connector's normalized store. The projection update is atomic, so detaching
 * first and restoring the projected relationships later is safe and prevents a
 * stale parent relationship from aborting the entire terminal snapshot.
 */
function removeBlockFromProjection(transaction: FeedTransaction, id: ReturnType<typeof blockId>): void {
  for (const parentId of transaction.summaryParentIdsForChild(id)) {
    transaction.setSummaryChildren(
      parentId,
      transaction.childIdsForSummary(parentId).filter((childId) => childId !== id),
    );
  }
  transaction.removeBlock(id);
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
  let entity = blockEntities.get(block);
  if (!entity) { entity = projectEntity(block); blockEntities.set(block, entity); }
  return entity;
}

function projectEntity(block: FeedDocumentProjection["blocks"][number]): FeedBlockEntity {
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
  const retained = toolEntities.get(item);
  if (retained) return retained;
  const entity: ToolItemEntity = {
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
  toolEntities.set(item, entity);
  return entity;
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
