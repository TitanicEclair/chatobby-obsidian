/**
 * Directory picker modal for vault folder selection.
 *
 * Uses Obsidian's FuzzySuggestModal to list all vault folders
 * (excluding the configured settings folder, .chatobby, and .git) with fuzzy search.
 *
 * Target architecture — see docs/vault-session-prefs.md for full design.
 */

import { App, FuzzySuggestModal, TFolder } from "obsidian";

/**
 * Modal for selecting the active Chatobby working directory.
 *
 * Usage:
 * ```ts
 * new DirectoryPickerModal(this.app, (folder) => {
 *   view.setWorkingDirectory(folder.path);
 * }).open();
 * ```
 */
export class DirectoryPickerModal extends FuzzySuggestModal<TFolder> {
  private onChooseCallback: (folder: TFolder) => void;

  constructor(app: App, onChoose: (folder: TFolder) => void) {
    super(app);
    this.onChooseCallback = onChoose;
    this.setPlaceholder("Pick a working directory…");
    this.setInstructions([
      { command: "↑↓", purpose: "to navigate" },
      { command: "↵", purpose: "to select" },
      { command: "esc", purpose: "to cancel" },
    ]);
  }

  getItems(): TFolder[] {
    const root = this.app.vault.getRoot();
    const excludedPrefixes = [this.app.vault.configDir, ".chatobby", ".git"];
    const folders = this.app.vault
      .getAllFolders(false)
      .filter(
        (folder) => !excludedPrefixes.some((prefix) => folder.path.startsWith(prefix)),
      );
    return [root, ...folders.filter((folder) => folder !== root)];
  }

  getItemText(folder: TFolder): string {
    return folder.path || "/";
  }

  onChooseItem(folder: TFolder): void {
    this.onChooseCallback(folder);
  }
}
