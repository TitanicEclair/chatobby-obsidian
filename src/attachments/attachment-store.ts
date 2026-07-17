import type { App } from "obsidian";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getChatobbyVaultRuntimePaths } from "../vault-runtime";
import type { ComposerAttachment, ComposerAttachmentDelivery, WsPromptAttachment } from "../types";

const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".yaml", ".yml", ".csv", ".tsv", ".xml", ".svg", ".html", ".css", ".js", ".ts", ".tsx", ".jsx", ".py", ".ps1", ".sh",
]);
const DOCUMENT_EXTENSIONS = new Set([
  ".pdf", ".docx", ".pptx", ".xlsx", ".odt", ".odp", ".ods", ".rtf",
]);
export const MAX_COMPOSER_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export async function storeComposerFile(app: App, file: File, draftId: string): Promise<ComposerAttachment> {
  if (file.size > MAX_COMPOSER_ATTACHMENT_BYTES) {
    throw new Error(`Attachments must be ${MAX_COMPOSER_ATTACHMENT_BYTES / 1024 / 1024} MB or smaller`);
  }
  const paths = getChatobbyVaultRuntimePaths(app);
  if (!paths) {
    throw new Error("Cannot resolve vault-local attachment store");
  }

  const id = randomUUID();
  const safeName = safeFileName(file.name || `attachment-${id}`);
  const folder = join(paths.attachmentDir, "drafts", draftId);
  const targetPath = join(folder, `${id}-${safeName}`);
  await mkdir(folder, { recursive: true });
  await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

  const mimeType = file.type || mimeTypeFromName(safeName);
  const delivery = deliveryForFile(safeName, mimeType);
  const prompt: WsPromptAttachment = {
    type: "file_ref",
    path: targetPath,
    name: safeName,
    mimeType,
    sizeBytes: file.size,
  };

  return {
    id,
    name: safeName,
    prompt,
    delivery,
    previewUrl: delivery === "image" ? URL.createObjectURL(file) : undefined,
    mimeType,
    sizeBytes: file.size,
    localPath: targetPath,
  };
}

export function revokeComposerAttachment(attachment: ComposerAttachment): void {
  if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
}

function safeFileName(name: string): string {
  const fileName = Array.from(basename(name), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || '<>:"/\\|?*'.includes(character) ? "-" : character;
  }).join("").trim();
  return fileName.length > 0 ? fileName : "attachment";
}

function deliveryForFile(name: string, mimeType: string): ComposerAttachmentDelivery {
  const extension = extensionOf(name);
  if (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mimeType)) return "image";
  if (DOCUMENT_EXTENSIONS.has(extension)) return "document";
  if (mimeType.startsWith("text/") || TEXT_EXTENSIONS.has(extension)) return "text";
  return "file";
}

function extensionOf(name: string): string {
  const match = /\.[^.]+$/.exec(name.toLowerCase());
  return match?.[0] ?? "";
}

function mimeTypeFromName(name: string): string {
  switch (extensionOf(name)) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    case ".pdf": return "application/pdf";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".odt": return "application/vnd.oasis.opendocument.text";
    case ".odp": return "application/vnd.oasis.opendocument.presentation";
    case ".ods": return "application/vnd.oasis.opendocument.spreadsheet";
    case ".rtf": return "application/rtf";
    case ".md": return "text/markdown";
    case ".json": return "application/json";
    case ".yaml":
    case ".yml": return "application/yaml";
    case ".csv": return "text/csv";
    case ".tsv": return "text/tab-separated-values";
    case ".html":
    case ".htm": return "text/html";
    case ".txt": return "text/plain";
    default: return "";
  }
}
