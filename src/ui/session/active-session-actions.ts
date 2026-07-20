import { Notice, type App } from "obsidian";
import type { SessionTab } from "../../features/session/public";
import type { OperationDescriptor } from "../../features/operations/public";
import type { ChatobbyTransport } from "../../transport/ws-client";
import type { SessionMutationRequest } from "../controller/session-controller";
import { pickItem, promptText } from "../modals/modals";

interface ActiveSessionActionsOptions {
  app: App;
  getTransport: () => ChatobbyTransport | null;
  getActiveTab: () => SessionTab | null;
  getForkOptions: () => readonly { entryId: string; label: string }[];
  getCurrentSessionPath: () => string | null;
  getCwd: () => string;
  openSessionView: (vaultPath: string, sessionPath: string) => Promise<void>;
  dispatchSessionIntent: (request: SessionMutationRequest) => Promise<boolean>;
  runOperation: <T>(descriptor: OperationDescriptor, operation: () => Promise<T>) => Promise<T>;
  runTransition: (label: string, operation: () => Promise<void>) => Promise<void>;
  setTab: (tab: SessionTab) => void;
  refreshTabs: () => void;
}

/** Advanced actions for the active backend session; stored-session rows use a separate path API. */
export class ActiveSessionActions {
  constructor(private readonly options: ActiveSessionActionsOptions) {}

  async rename(): Promise<void> {
    const active = this.options.getActiveTab();
    if (!this.options.getTransport()?.isConnected || !active) return;
    const name = await promptText(this.options.app, {
      title: "Rename session",
      value: active.name ?? "",
      placeholder: "Session name",
      submitLabel: "Rename",
    });
    if (!name?.trim()) return;
    const normalizedName = name.trim();
    await this.options.runTransition("Renaming session", async () => {
      if (!await this.options.dispatchSessionIntent({ type: "session.rename", payload: { name: normalizedName } })) return;
      this.options.setTab({ ...active, name: normalizedName });
      this.options.refreshTabs();
    });
  }

  async clone(): Promise<void> {
    const originalPath = this.options.getCurrentSessionPath();
    await this.options.runTransition("Cloning session", async () => {
      await this.options.dispatchSessionIntent({ type: "session.clone", payload: {} });
    });
    // The clone is now the active session in this view. Open the original in a
    // new leaf so both are visible side-by-side.
    if (originalPath) {
      void this.options.openSessionView(this.options.getCwd(), originalPath);
    }
  }

  async fork(): Promise<void> {
    const options = this.options.getForkOptions();
    if (options.length === 0) {
      new Notice("No fork points available yet.");
      return;
    }
    const choice = await pickItem(this.options.app, [...options], (option) => option.label, "Choose a fork point");
    if (!choice) return;
    const originalPath = this.options.getCurrentSessionPath();
    await this.options.runTransition("Forking session", async () => {
      await this.options.dispatchSessionIntent({ type: "session.fork", payload: { entryId: choice.entryId } });
    });
    if (originalPath) {
      void this.options.openSessionView(this.options.getCwd(), originalPath);
    }
  }

  async importJsonl(): Promise<void> {
    const inputPath = await promptText(this.options.app, {
      title: "Import session from JSONL",
      placeholder: "Path to .jsonl file",
      submitLabel: "Import",
    });
    if (!inputPath?.trim()) return;
    await this.options.runTransition("Importing session", async () => {
      await this.options.dispatchSessionIntent({
        type: "session.import-jsonl",
        payload: { inputPath: inputPath.trim() },
      });
    });
  }

  async export(format: "html" | "jsonl"): Promise<void> {
    const transport = this.options.getTransport();
    if (!transport?.isConnected) return;
    const outputPath = await promptText(this.options.app, {
      title: `Export session as ${format.toUpperCase()}`,
      value: `chatobby-export.${format}`,
      placeholder: "Output path",
      submitLabel: "Export",
    });
    if (!outputPath?.trim()) return;
    const path = await this.options.runOperation(
      { key: "session-maintenance", id: `session:export-${format}`, label: `Exporting session as ${format.toUpperCase()}` },
      () => format === "html" ? transport.exportHtml(outputPath.trim()) : transport.exportJsonl(outputPath.trim()),
    );
    new Notice(`Exported to ${path}`);
  }
}
