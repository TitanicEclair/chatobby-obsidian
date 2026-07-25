import { type App, normalizePath, Notice, TFile, TFolder } from "obsidian";
import { confirmAction } from "../../ui/modals/modals";
import {
  CHATOBBY_GUIDE_DIRECTORY,
  CHATOBBY_GUIDE_FILENAME,
  CHATOBBY_GUIDE_FILES,
  CHATOBBY_GUIDE_MARKDOWN,
  type GuideFile,
} from "./guide-content";

export {
  CHATOBBY_GUIDE_DIRECTORY,
  CHATOBBY_GUIDE_FILENAME,
  CHATOBBY_GUIDE_FILES,
  CHATOBBY_GUIDE_MARKDOWN,
  type GuideFile,
};

export interface GuideContent {
  content: string;
  path: string;
  title: string;
  version: string;
  earlyAccess: boolean;
  confirmationNotice: string;
  /** Present on runtimes that support the linked multi-page guide. */
  files?: readonly GuideFile[];
}

export interface DownloadChatobbyGuideOptions {
  app: App;
  /** Returns the live transport, or null when the runtime is not connected. */
  getTransport(): { getGuide(): Promise<GuideContent> } | null;
  /** Called with a user-facing error message when the guide cannot be written. */
  onError?(message: string): void;
}

const STATIC_CONFIRMATION_NOTICE =
  "This early guide is still being developed. It does not yet include visual aids or complete guidance for every feature. Copy the linked Chatobby Guide folder into this vault? Existing guide pages will be updated; unrelated notes will not be changed.";

/**
 * Copy the linked Chatobby guide into the vault. Current runtimes provide a
 * complete file set; older runtimes fall back to the bundled guide rather than
 * downgrading the folder to one note.
 */
export async function downloadChatobbyGuide(options: DownloadChatobbyGuideOptions): Promise<void> {
  let files = CHATOBBY_GUIDE_FILES;
  let notice = STATIC_CONFIRMATION_NOTICE;

  const transport = options.getTransport();
  if (transport) {
    try {
      const guide = await transport.getGuide();
      files = normalizeGuideFiles(guide.files) ?? CHATOBBY_GUIDE_FILES;
      notice = guide.confirmationNotice || notice;
    } catch {
      // Runtime unavailable or old runtime without get_guide — use the bundled guide.
    }
  }

  const directory = options.app.vault.getAbstractFileByPath(CHATOBBY_GUIDE_DIRECTORY);
  if (directory && !(directory instanceof TFolder)) {
    options.onError?.(`${CHATOBBY_GUIDE_DIRECTORY} is already used by a file.`);
    return;
  }

  const existingFiles = new Map<string, TFile>();
  for (const file of files) {
    const existing = options.app.vault.getAbstractFileByPath(file.path);
    if (existing && !(existing instanceof TFile)) {
      options.onError?.(`${file.path} is already used by a folder.`);
      return;
    }
    if (existing) existingFiles.set(file.path, existing);
  }

  const confirmed = await confirmAction(options.app, {
    title: directory ? "Update Chatobby Guide?" : "Add Chatobby Guide?",
    message: `${notice}\n\nThis will write ${files.length} linked pages inside ${CHATOBBY_GUIDE_DIRECTORY}.`,
    confirmLabel: directory ? "Update guide" : "Copy guide",
    destructive: false,
  });
  if (!confirmed) return;

  try {
    if (!directory) await options.app.vault.createFolder(CHATOBBY_GUIDE_DIRECTORY);
    for (const file of files) {
      const existing = existingFiles.get(file.path);
      if (existing) await options.app.vault.modify(existing, file.content);
      else await options.app.vault.create(file.path, file.content);
    }
  } catch (error) {
    options.onError?.(`Could not write the Chatobby Guide: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  new Notice(`Chatobby Guide ${directory ? "updated" : "added"} (${files.length} pages).`);
}

function normalizeGuideFiles(files: readonly GuideFile[] | undefined): readonly GuideFile[] | null {
  if (!files || files.length === 0) return null;
  const normalized: GuideFile[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const path = normalizePath(file.path);
    if (
      !path.startsWith(`${CHATOBBY_GUIDE_DIRECTORY}/`)
      || !path.endsWith(".md")
      || path.split("/").includes("..")
      || !file.title.trim()
      || !file.content.trim()
      || seen.has(path)
    ) {
      return null;
    }
    seen.add(path);
    normalized.push({ path, title: file.title, content: file.content });
  }
  return normalized;
}
