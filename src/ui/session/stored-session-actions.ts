import { Notice, type App } from "obsidian";
import type { StoredSessionController } from "../../features/session/public";
import type { WsStoredSessionSelector } from "../../vendor/chatobby-client/connector-types";
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

  async run(selector: WsStoredSessionSelector, action: SessionAdvancedAction): Promise<void> {
    if (action === "rename") await this.rename(selector);
    else if (action === "clone") {
      await this.options.sessions.clone(selector);
      new Notice("Session cloned.");
    } else if (action === "fork") await this.fork(selector);
    else await this.export(selector, action === "export-html" ? "html" : "jsonl");
    this.options.refresh();
  }

  private async rename(selector: WsStoredSessionSelector): Promise<void> {
    const name = await promptText(this.options.app, {
      title: "Rename session",
      placeholder: "Session name",
      submitLabel: "Rename",
    });
    if (name?.trim()) await this.options.sessions.rename(selector, name.trim());
  }

  private async fork(selector: WsStoredSessionSelector): Promise<void> {
    const messages = await this.options.sessions.forkMessages(selector);
    if (messages.length === 0) {
      new Notice("No fork points are available in this session.");
      return;
    }
    const choice = await pickItem(this.options.app, messages, (message) => message.text, "Choose a fork point");
    if (!choice) return;
    await this.options.sessions.fork(selector, choice.entryId);
    new Notice("Session fork created.");
  }

  private async export(selector: WsStoredSessionSelector, format: "html" | "jsonl"): Promise<void> {
    const outputPath = await promptText(this.options.app, {
      title: `Export session as ${format.toUpperCase()}`,
      value: `chatobby-export.${format}`,
      placeholder: "Output path",
      submitLabel: "Export",
    });
    if (!outputPath?.trim()) return;
    const exportedPath = await this.options.sessions.export(selector, format, outputPath.trim());
    new Notice(`Exported to ${exportedPath}`);
  }
}
