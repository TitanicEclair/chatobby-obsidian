// Narrow connector specialists that benefit from Obsidian-owned semantics.

import type { App, TFile } from "obsidian";
import type { OperationHandler } from "../types";
import { BridgeError } from "../types";
import { base64ToArrayBuffer } from "./helpers/binary";
import { getFilteredMarkdownFiles } from "./helpers/search";

function strArg(args: Record<string, unknown>, key: string, required: true): string;
function strArg(args: Record<string, unknown>, key: string, required: false): string | undefined;
function strArg(args: Record<string, unknown>, key: string, required: boolean): string | undefined {
  const value = args[key];
  if (typeof value === "string") return value;
  if (required) throw new BridgeError("INVALID_INPUT", `Missing required string argument: ${key}`);
  return undefined;
}

export const handleLinksAudit: OperationHandler = async (args, signal, app) => {
  const folder = strArg(args, "folder", false);
  const limit = typeof args.limit === "number" ? args.limit : 200;
  const files = getFilteredMarkdownFiles(app, folder);
  const broken: Array<{ path: string; target: string; line?: number }> = [];

  for (const file of files) {
    if (signal.aborted) break;
    const links = app.metadataCache.getFileCache(file)?.links;
    if (!links) continue;
    for (const link of links) {
      const resolved = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
      if (!resolved) {
        broken.push({
          path: file.path,
          target: link.link,
          ...(link.position?.start.line !== undefined ? { line: link.position.start.line } : {}),
        });
      }
      if (broken.length >= limit) break;
    }
    if (broken.length >= limit) break;
  }

  return { broken, count: broken.length };
};

export const handleAttachmentImport: OperationHandler = async (args, _signal, app) => {
  const requestedPath = strArg(args, "targetPath", false);
  const fileName = strArg(args, "fileName", false);
  const activeFile = (app.workspace as unknown as { getActiveFile?: () => TFile | null }).getActiveFile?.();
  const sourceNotePath = strArg(args, "sourceNotePath", false) ?? activeFile?.path ?? "";
  if (!requestedPath && !fileName) {
    throw new BridgeError("INVALID_INPUT", "attachment.import requires targetPath or fileName");
  }

  const path = normalizeVaultPath(
    requestedPath ?? await app.fileManager.getAvailablePathForAttachment(fileName as string, sourceNotePath || undefined),
  );
  if (app.vault.getAbstractFileByPath(path)) {
    throw new BridgeError("PATH_EXISTS", `Attachment already exists: ${path}`);
  }
  await ensureVaultParent(app, path);

  const base64 = typeof args.content === "string" ? args.content : undefined;
  const mimeType = typeof args.mimeType === "string" ? args.mimeType : undefined;
  let file: TFile;
  let sizeBytes: number;
  if (base64 !== undefined) {
    const buffer = base64ToArrayBuffer(base64);
    sizeBytes = buffer.byteLength;
    file = await (app.vault as unknown as {
      createBinary: (path: string, data: ArrayBuffer) => Promise<TFile>;
    }).createBinary(path, buffer);
  } else if (typeof args.text === "string") {
    sizeBytes = args.text.length;
    file = await app.vault.create(path, args.text);
  } else {
    throw new BridgeError("INVALID_INPUT", "attachment.import requires 'content' (base64) or 'text'");
  }

  const markdownLink = app.fileManager.generateMarkdownLink(file, sourceNotePath);
  return {
    path,
    sizeBytes,
    markdownLink,
    markdownEmbed: `!${markdownLink}`,
    ...(mimeType ? { mimeType } : {}),
  };
};

async function ensureVaultParent(app: App, filePath: string): Promise<void> {
  const segments = filePath.split("/").slice(0, -1);
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
}
