import { Notice, type App } from "obsidian";
import type { ChatobbyTransport } from "../../transport/ws-client";
import type { WsAutoCompactionSettings } from "../../types";
import { AutoCompactionModal } from "../modals/auto-compaction-modal";

export interface AutoCompactionActionOptions {
  transport: ChatobbyTransport | null;
  settings: WsAutoCompactionSettings;
  apply: (settings: WsAutoCompactionSettings) => void;
  runMutation: <T>(operation: () => Promise<T>) => Promise<T>;
}

/** Toggle the active model's compaction policy and reconcile the returned backend state. */
export async function toggleAutoCompaction(options: AutoCompactionActionOptions): Promise<void> {
  const transport = options.transport;
  if (!transport?.isConnected) {
    new Notice("Chatobby is not connected; cannot toggle automatic compaction yet.");
    return;
  }
  try {
    const settings = await options.runMutation(() => (
      transport.setAutoCompaction({ enabled: !options.settings.enabled })
    ));
    options.apply(settings);
    new Notice(`Auto-compaction ${settings.enabled ? "enabled" : "disabled"} for this model.`);
  } catch (error) {
    console.error("Chatobby: setAutoCompaction failed", error);
    new Notice(`Could not update automatic compaction: ${errorMessage(error)}`);
  }
}

/** Open per-model automatic-compaction settings when a connected model exists. */
export function openAutoCompactionSettings(
  app: App,
  model: string | null,
  options: AutoCompactionActionOptions,
): void {
  const transport = options.transport;
  if (!transport?.isConnected || !model) {
    new Notice("Select a model before configuring automatic compaction.");
    return;
  }
  new AutoCompactionModal(app, {
    model,
    settings: options.settings,
    save: async (patch) => {
      if (!transport.isConnected) throw new Error("Chatobby disconnected before automatic compaction could be saved.");
      const settings = await options.runMutation(() => transport.setAutoCompaction(patch));
      options.apply(settings);
      return settings;
    },
  }).open();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
