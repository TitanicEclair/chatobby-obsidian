import { Menu, Notice, TFolder, type TAbstractFile } from "obsidian";
import { errorMessage } from "../../utils";
import { normalizeVaultDirectoryInput } from "./session-directory";

export interface FileExplorerSessionActions {
  startNewSession(vaultDirectoryPath: string): Promise<void>;
  resumeSession(vaultDirectoryPath: string): Promise<void>;
  createProject(vaultDirectoryPath: string): Promise<void>;
}

/** Resolve a selected folder, or the parent folder of a selected file. */
export function resolveFileExplorerDirectory(file: TAbstractFile): string {
  const folder = file instanceof TFolder ? file : file.parent;
  return normalizeVaultDirectoryInput(folder?.path ?? "");
}

/** Add Chatobby's directory-scoped actions to Obsidian's native file menu. */
export function addFileExplorerSessionMenuItems(
  menu: Menu,
  file: TAbstractFile,
  actions: FileExplorerSessionActions,
): void {
  const directory = resolveFileExplorerDirectory(file);
  menu.addItem((item) => item
    .setSection("chatobby")
    .setTitle("New Chatobby session here")
    .setIcon("message-square-plus")
    .onClick(() => runFileMenuAction(
      "start a new session",
      () => actions.startNewSession(directory),
    )));
  menu.addItem((item) => item
    .setSection("chatobby")
		.setTitle("View Chatobby sessions here")
    .setIcon("history")
    .onClick(() => runFileMenuAction(
			"open sessions for this folder",
      () => actions.resumeSession(directory),
    )));
  menu.addItem((item) => item
    .setSection("chatobby")
    .setTitle("Create Chatobby Project from folder")
    .setIcon("folder-kanban")
    .onClick(() => runFileMenuAction(
      "create a Project from this folder",
      () => actions.createProject(directory),
    )));
}

function runFileMenuAction(label: string, action: () => Promise<void>): void {
  void action().catch((error) => {
    console.error(`Chatobby: could not ${label}`, error);
    new Notice(`Could not ${label}: ${errorMessage(error)}`);
  });
}
