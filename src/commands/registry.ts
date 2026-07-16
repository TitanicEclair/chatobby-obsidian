// Command registry — separates plugin *functionality* (organized as ChatobbyAction
// records in src/commands/actions/) from *Obsidian command registration*. Each
// action is a declarative { id, name, group, run } record; the registry registers
// them as Obsidian palette commands with a single shared error handler, and also
// exposes them for programmatic invocation (run(id)) and discovery (list()).
//
// To add a new command: drop a record into the relevant actions/*.ts file. No
// edits to main.ts required.

import type { Plugin } from "obsidian";
import type { ChatobbyView } from "../ui/view";
import type { ChatobbyTransport } from "../transport/ws-client";
import { errorMessage, notifyUser } from "../utils";
import { OperationConflictError } from "../features/operations/public";

/** Logical grouping for documentation/discovery (not surfaced by Obsidian). */
export type ActionGroup =
  | "backend"
  | "navigation"
  | "model"
  | "session"
  | "capture"
  | "transport"
  | "action";

/** Narrow service surface actions depend on — decouples them from the plugin class. */
export interface ChatobbyServices {
  /** Reveal/opens the Chatobby view. */
  activateView(): Promise<void>;
  /** Ensure the view is open, then run an action against it. */
  withView(fn: (view: ChatobbyView) => void | Promise<void>): Promise<void>;
  /** Current WS transport (may be null before first connect). */
  getTransport(): ChatobbyTransport | null;
  /** Prepare the configured runtime and return its connected transport. */
  ensureTransport(): Promise<ChatobbyTransport>;
  /** Backend controller (start/stop). */
  readonly backend: { start(): Promise<void>; stop(): Promise<void> };
  /** Cycle the active session's model and refresh UI. */
  cycleModel(): Promise<void>;
  /** Cycle the active session's thinking level, persist it, refresh UI. */
  cycleThinking(): Promise<void>;
  /** Focus the active note's editor (for the focus shuttle). */
  focusActiveEditor(): void;
}

/** A single invocable command. */
export interface ChatobbyAction {
  /** Obsidian command id (registered as `chatobby:<id>`). */
  id: string;
  /** Display name in the command palette. */
  name: string;
  /** Logical group (docs/discovery only). */
  group: ActionGroup;
  /** Whether this action belongs in Obsidian's general command palette. */
  palette?: boolean;
  /** The action body. Errors are caught + surfaced by the registry. */
  run: (services: ChatobbyServices) => void | Promise<void>;
}

export class CommandRegistry {
  private readonly actions = new Map<string, ChatobbyAction>();

  constructor(
    private readonly plugin: Plugin,
    private readonly services: ChatobbyServices,
  ) {}

  register(action: ChatobbyAction): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Chatobby command already registered: ${action.id}`);
    }
    this.actions.set(action.id, action);
  }

  registerAll(actions: readonly ChatobbyAction[]): void {
    for (const action of actions) this.register(action);
  }

  /** Register every action as an Obsidian palette command with shared error handling. */
  registerAsObsidianCommands(): void {
    for (const action of this.actions.values()) {
      if (action.palette === false) continue;
      this.plugin.addCommand({
        id: action.id,
        name: action.name,
        callback: () => {
          void this.invoke(action);
        },
      });
    }
  }

  /** Invoke an action by id programmatically (e.g. from the URI handler). */
  async run(id: string): Promise<void> {
    const action = this.actions.get(id);
    if (!action) {
      console.warn(`Chatobby: unknown command "${id}"`);
      return;
    }
    await this.invoke(action);
  }

  /** Enumerate registered actions (for docs/CLI discovery). */
  list(): ChatobbyAction[] {
    return [...this.actions.values()];
  }

  private async invoke(action: ChatobbyAction): Promise<void> {
    try {
      await action.run(this.services);
    } catch (error) {
      if (error instanceof OperationConflictError) {
        notifyUser(error.message);
        return;
      }
      console.error(`Chatobby: command "${action.id}" failed`, error);
      notifyUser(`Chatobby "${action.name}" failed: ${errorMessage(error)}`);
    }
  }
}
