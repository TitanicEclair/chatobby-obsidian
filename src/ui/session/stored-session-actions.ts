import { Notice, type App } from "obsidian";
import type { StoredSessionController } from "../../features/session/public";
import { pickItem, promptText } from "../modals/modals";
import type { SessionAdvancedAction } from "./session-maintenance";

interface StoredSessionActionsOptions {
  app: App;
  sessions: StoredSessionController;
  refresh: () => void;
}

/** User-facing prompts and receipts for contextual stored-session operations. */
export class StoredSessionActions {
  constructor(private readonly options: StoredSessionActionsOptions) {}

  async run(sessionPath: string, action: SessionAdvancedAction): Promise<void> {
    if (action === "rename") await this.rename(sessionPath);
    else if (action === "clone") {
      await this.options.sessions.clone(sessionPath);
      new Notice("Session cloned.");
    } else if (action === "fork") await this.fork(sessionPath);
    else await this.export(sessionPath, action === "export-html" ? "html" : "jsonl");
    this.options.refresh();
  }

  private async rename(sessionPath: string): Promise<void> {
    const name = await promptText(this.options.app, {
      title: "Rename session",
      placeholder: "Session name",
      submitLabel: "Rename",
    });
    if (name?.trim()) await this.options.sessions.rename(sessionPath, name.trim());
  }

  private async fork(sessionPath: string): Promise<void> {
    const messages = await this.options.sessions.forkMessages(sessionPath);
    if (messages.length === 0) {
      new Notice("No fork points are available in this session.");
      return;
    }
    const choice = await pickItem(this.options.app, messages, (message) => message.text, "Choose a fork point");
    if (!choice) return;
    await this.options.sessions.fork(sessionPath, choice.entryId);
    new Notice("Session fork created.");
  }

  private async export(sessionPath: string, format: "html" | "jsonl"): Promise<void> {
    const outputPath = await promptText(this.options.app, {
      title: `Export session as ${format.toUpperCase()}`,
      value: `chatobby-export.${format}`,
      placeholder: "Output path",
      submitLabel: "Export",
    });
    if (!outputPath?.trim()) return;
    const exportedPath = await this.options.sessions.export(sessionPath, format, outputPath.trim());
    new Notice(`Exported to ${exportedPath}`);
  }
}
