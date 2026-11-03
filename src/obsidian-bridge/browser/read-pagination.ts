import type { BrowserSemanticArtifact } from "./artifact-store";
import type { BrowserTabInfo } from "./tab-state";
import { BridgeError } from "../types";
import { asRecord } from "./webview";

export const DEFAULT_MAX_CHARS = 24_000;
const SOFT_MAX_CHARS = 32_000;
export const HARD_MAX_CHARS = 96_000;

export interface BrowserCursor {
  documentId: string;
  revision: number;
  blockIndex: number;
  blockOffset: number;
  format: "markdown" | "text" | "structured";
}

interface BrowserListCursor {
  offset: number;
  fingerprint: string;
}

export function encodeCursor(cursor: BrowserCursor): string {
  return `browser-v2:${encodeURIComponent(JSON.stringify(cursor))}`;
}

export function decodeCursor(value: unknown): BrowserCursor | null {
  if (typeof value !== "string" || !value.startsWith("browser-v2:")) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice("browser-v2:".length))) as Partial<BrowserCursor>;
    if (
      typeof parsed.documentId !== "string"
      || !Number.isInteger(parsed.revision)
      || !Number.isInteger(parsed.blockIndex)
      || !Number.isInteger(parsed.blockOffset)
      || (parsed.format !== "markdown" && parsed.format !== "text" && parsed.format !== "structured")
    ) return null;
    return parsed as BrowserCursor;
  } catch {
    return null;
  }
}

export function browserListFingerprint(tabs: BrowserTabInfo[]): string {
  let hash = 2_166_136_261;
  const source = tabs.map((tab) => `${tab.leafId}\u001f${tab.url ?? ""}`).join("\u001e");
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export function encodeListCursor(cursor: BrowserListCursor): string {
  return `browser-list-v1:${encodeURIComponent(JSON.stringify(cursor))}`;
}

export function decodeListCursor(value: unknown): BrowserListCursor | null {
  if (typeof value !== "string" || !value.startsWith("browser-list-v1:")) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice("browser-list-v1:".length))) as Partial<BrowserListCursor>;
    if (!Number.isInteger(parsed.offset) || (parsed.offset ?? -1) < 0 || typeof parsed.fingerprint !== "string") return null;
    return parsed as BrowserListCursor;
  } catch {
    return null;
  }
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

export function createArtifact(leafId: string, data: Record<string, unknown>): BrowserSemanticArtifact {
  const page = asRecord(data.page);
  const documentId = typeof page.documentId === "string" ? page.documentId : "";
  const revision = typeof page.revision === "number" ? page.revision : -1;
  if (!documentId || !Number.isInteger(revision) || revision < 0) {
    throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web Viewer returned an invalid semantic document identity");
  }
  return {
    documentId,
    revision,
    leafId,
    capturedAt: new Date().toISOString(),
    page,
    metadata: asRecord(data.metadata),
    root: asRecord(data.root),
    blocks: recordArray(data.blocks),
    outline: recordArray(data.outline),
    links: recordArray(data.links),
    coverage: asRecord(data.coverage),
    captureTruncated: data.captureTruncated === true,
  };
}

export function blockText(block: Record<string, unknown>, format: BrowserCursor["format"]): string {
  if (format === "text") return String(block.text ?? "");
  return String(block.markdown ?? block.text ?? "");
}

export function tokenEstimate(characters: number): number {
  return Math.ceil(characters / 3.5);
}

export function paginateBlocks(
  blocks: Array<Record<string, unknown>>,
  format: BrowserCursor["format"],
  cursor: BrowserCursor,
  maxChars: number,
): {
  text: string;
  blocks: Array<Record<string, unknown>>;
  next?: BrowserCursor;
  returnedBlockCount: number;
  remainingBlockCount: number;
  estimatedRemainingTokens: number;
} {
  const output: string[] = [];
  const selected: Array<Record<string, unknown>> = [];
  let blockIndex = cursor.blockIndex;
  let blockOffset = cursor.blockOffset;
  const startingBlockIndex = blockIndex;
  while (blockIndex < blocks.length) {
    const block = blocks[blockIndex] as Record<string, unknown>;
    const source = blockText(block, format);
    const separator = output.length > 0 ? "\n\n" : "";
    const currentLength = output.reduce((total, part) => total + part.length, 0);
    const remainingTarget = Math.max(0, maxChars - currentLength - separator.length);
    const remainingSource = source.slice(blockOffset);
    const wholeBlockLimit = Math.min(HARD_MAX_CHARS, Math.max(maxChars, SOFT_MAX_CHARS));
    if (
      output.length > 0
      && remainingSource.length > remainingTarget
      && currentLength + separator.length + remainingSource.length > wholeBlockLimit
    ) break;
    const available = output.length === 0
      ? Math.min(HARD_MAX_CHARS, Math.max(remainingTarget, Math.min(remainingSource.length, SOFT_MAX_CHARS)))
      : Math.min(remainingSource.length, Math.max(remainingTarget, wholeBlockLimit - currentLength - separator.length));
    if (available <= 0) break;
    const fragment = remainingSource.slice(0, available);
    output.push(`${separator}${fragment}`);
    selected.push({ ...block, ...(blockOffset > 0 || fragment.length < source.length ? { fragmentOffset: blockOffset } : {}) });
    blockOffset += fragment.length;
    if (blockOffset < source.length) {
      const remainingCharacters = source.length - blockOffset
        + blocks.slice(blockIndex + 1).reduce((total, candidate) => total + blockText(candidate, format).length + 2, 0);
      return {
        text: output.join(""),
        blocks: selected,
        next: { ...cursor, blockIndex, blockOffset },
        returnedBlockCount: blockIndex - startingBlockIndex + 1,
        remainingBlockCount: blocks.length - blockIndex,
        estimatedRemainingTokens: tokenEstimate(remainingCharacters),
      };
    }
    blockIndex += 1;
    blockOffset = 0;
    if (output.reduce((total, part) => total + part.length, 0) >= maxChars) break;
  }
  const remainingCharacters = blocks
    .slice(blockIndex)
    .reduce((total, candidate) => total + blockText(candidate, format).length + 2, 0);
  return {
    text: output.join(""),
    blocks: selected,
    ...(blockIndex < blocks.length ? { next: { ...cursor, blockIndex, blockOffset } } : {}),
    returnedBlockCount: Math.max(0, blockIndex - startingBlockIndex),
    remainingBlockCount: Math.max(0, blocks.length - blockIndex),
    estimatedRemainingTokens: tokenEstimate(remainingCharacters),
  };
}
