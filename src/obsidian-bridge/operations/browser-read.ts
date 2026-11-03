import { BrowserArtifactStore, type BrowserSemanticArtifact } from "../browser/artifact-store";
import { browserTabInfo, type BrowserTabInfo } from "../browser/tab-state";
import {
  assertNotAborted, getLeafId, leafIdFrom, requireBrowserLeaf, requireWebView,
  runPageOperation, type WebViewElement,
} from "../browser/webview";
import {
  blockText, createArtifact, decodeCursor, DEFAULT_MAX_CHARS, encodeCursor,
  HARD_MAX_CHARS, paginateBlocks, tokenEstimate, type BrowserCursor,
} from "../browser/read-pagination";
import { BridgeError, type OperationHandler } from "../types";

const browserArtifactStore = new BrowserArtifactStore();

export function removeBrowserReadArtifacts(leafId: string): void {
  browserArtifactStore.deleteLeaf(leafId);
}

export const handleBrowserRead: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const maxChars = typeof args.maxChars === "number" ? args.maxChars : DEFAULT_MAX_CHARS;
  if (!Number.isInteger(maxChars) || maxChars <= 0 || maxChars > HARD_MAX_CHARS) {
    throw new BridgeError("INVALID_INPUT", `browser.read maxChars must be an integer from 1 to ${HARD_MAX_CHARS}`);
  }
  const format = args.format === "text" || args.format === "structured" ? args.format : "markdown";
  const legacyStartIndex = typeof args.startIndex === "number" ? args.startIndex : undefined;
  if (legacyStartIndex !== undefined && (!Number.isInteger(legacyStartIndex) || legacyStartIndex < 0)) {
    throw new BridgeError("INVALID_INPUT", "browser.read startIndex must be a non-negative integer");
  }
  if (legacyStartIndex !== undefined && args.cursor !== undefined) {
    throw new BridgeError("INVALID_INPUT", "browser.read accepts cursor or startIndex, not both");
  }
  const decoded = decodeCursor(args.cursor);
  if (args.cursor !== undefined && !decoded) throw new BridgeError("INVALID_INPUT", "browser.read cursor is invalid");
  if (decoded && decoded.format !== format) {
    throw new BridgeError("INVALID_INPUT", `Browser read cursor is bound to ${decoded.format} output`);
  }
  if (decoded && (args.scopeSelector !== undefined || args.ref !== undefined || args.includeHtml === true)) {
    throw new BridgeError("INVALID_INPUT", "A browser read continuation cannot change scope or request HTML");
  }

  let artifact: BrowserSemanticArtifact;
  let tab: BrowserTabInfo | undefined;
  let data: Record<string, unknown> | undefined;
  let webview: WebViewElement | undefined;
  if (decoded) {
    const retained = browserArtifactStore.get(decoded.documentId, decoded.revision);
    if (!retained) {
      throw new BridgeError(
        "RESULT_EXPIRED",
        "The retained browser document expired; start a fresh browser read",
        true,
      );
    }
    artifact = retained;
  } else {
    const leaf = requireBrowserLeaf(app, leafIdFrom(args));
    webview = requireWebView(leaf);
    data = await runPageOperation(webview, "read", {
      scopeSelector: args.scopeSelector,
      ref: args.ref,
      documentId: args.documentId,
      revision: args.revision,
    });
    assertNotAborted(signal);
    artifact = createArtifact(getLeafId(leaf), data);
    browserArtifactStore.put(artifact);
    tab = await browserTabInfo(app, leaf);
  }

  const initial: BrowserCursor = decoded ?? {
    documentId: artifact.documentId,
    revision: artifact.revision,
    blockIndex: 0,
    blockOffset: 0,
    format,
  };
  const blocks = artifact.blocks;
  const legacyText = legacyStartIndex === undefined
    ? undefined
    : blocks
      .map((block) => blockText(block, format))
      .join("\n\n");
  const paged = legacyText === undefined
    ? paginateBlocks(blocks, format, initial, maxChars)
    : {
      text: legacyText.slice(legacyStartIndex ?? 0, (legacyStartIndex ?? 0) + maxChars),
      blocks: [],
      returnedBlockCount: 0,
      remainingBlockCount: 0,
      estimatedRemainingTokens: tokenEstimate(
        Math.max(0, legacyText.length - ((legacyStartIndex ?? 0) + maxChars)),
      ),
    };
  const legacyNextStartIndex = legacyText !== undefined && legacyStartIndex !== undefined
    && legacyStartIndex + paged.text.length < legacyText.length
    ? legacyStartIndex + paged.text.length
    : undefined;
  const includeHtml = args.includeHtml === true;
  let htmlResult: Record<string, unknown> | undefined;
  if (includeHtml && webview) {
    htmlResult = await runPageOperation(webview, "dom", {
      operation: "html",
      cssSelector: args.scopeSelector,
      ref: args.ref,
      documentId: args.documentId,
      revision: args.revision,
      maxChars,
    });
  }
  const hasMore = Boolean(paged.next) || legacyNextStartIndex !== undefined || artifact.captureTruncated;
  return {
    available: true,
    captureOrigin: decoded ? "retained" : "live",
    servedAt: new Date().toISOString(),
    ...(tab ?? { leafId: artifact.leafId }),
    page: artifact.page,
    metadata: artifact.metadata,
    root: artifact.root,
    outline: artifact.outline,
    links: artifact.links,
    capturedAt: artifact.capturedAt,
    blocks: paged.blocks,
    text: paged.text,
    format,
    returnedChars: paged.text.length,
    truncated: hasMore,
    coverage: {
      kind: artifact.captureTruncated ? "partial" : "exact",
      returned: paged.returnedBlockCount,
      total: blocks.length,
      hasMore,
      remaining: paged.remainingBlockCount,
      estimatedRemainingTokens: paged.estimatedRemainingTokens,
      ...(paged.next ? { nextCursor: encodeCursor(paged.next) } : {}),
      ...(artifact.coverage.warnings ? { warnings: artifact.coverage.warnings } : {}),
    },
    ...(paged.next ? { nextCursor: encodeCursor(paged.next) } : {}),
    ...(legacyStartIndex !== undefined ? { startIndex: legacyStartIndex } : {}),
    ...(legacyNextStartIndex !== undefined ? { nextStartIndex: legacyNextStartIndex } : {}),
    ...(htmlResult ? {
      html: htmlResult.html,
      htmlTruncated: htmlResult.truncated,
      htmlTotalChars: htmlResult.totalChars,
      htmlSanitized: true,
    } : {}),
  };
};
