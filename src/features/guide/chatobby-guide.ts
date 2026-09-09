import {
  CHATOBBY_GUIDE_DIRECTORY,
  type ChatobbyGuideChannelAsset,
  type ChatobbyGuideAssetFile,
} from "../../vendor/chatobby-client/ws-client.js";
import { type App, Notice, TFile, TFolder } from "obsidian";
import { confirmAction } from "../../ui/modals/modals";

export { CHATOBBY_GUIDE_DIRECTORY };
export type GuideFile = ChatobbyGuideAssetFile;
/** One-version runtime get_guide compatibility response. */
export interface GuideContent {
  content: string;
  path: string;
  title: string;
  version: string;
  earlyAccess: boolean;
  confirmationNotice: string;
  files?: readonly GuideFile[];
}

export interface DownloadChatobbyGuideOptions {
  app: App;
  /** Fetches the signed, compatible, hash-bound Guide channel asset. */
  fetchGuide(): Promise<ChatobbyGuideChannelAsset>;
  /** Called with a user-facing error message when the guide cannot be written. */
  onError?(message: string): void;
}

/**
 * Download and verify the compatible Guide channel before asking to overwrite vault
 * notes. Missing, offline, or invalid assets leave the existing guide intact.
 */
export async function downloadChatobbyGuide(options: DownloadChatobbyGuideOptions): Promise<void> {
  let guide: ChatobbyGuideChannelAsset;
  try {
    guide = await options.fetchGuide();
  } catch (error) {
    options.onError?.(
      `Could not download the Chatobby Guide; existing guide notes were left unchanged. Retry when online. ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  const files = guide.files;
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
    message: `${guide.confirmationNotice}\n\nThis will write ${files.length} linked pages inside ${CHATOBBY_GUIDE_DIRECTORY}.`,
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
