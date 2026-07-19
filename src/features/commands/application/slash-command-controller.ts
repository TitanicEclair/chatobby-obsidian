import type { WsPromptAttachment } from "../../../types";
import type { SlashCommandSpec, SlashParsedCommand, SlashSubmitPlan } from "../../../ui/composer/slash-command";
import { fixedWhitespaceArgs, noArgs, optionalPathArg, optionalRestOfLineArg, requiredRestOfLineArg } from "../../../ui/composer/slash-parsers";
import { hasNonWhitespaceOutside, removeTextRanges } from "../../../ui/composer/slash-state";
import type { FrontendLocalCommandViewModel } from "../../../vendor/chatobby-client/frontend-contracts.js";
import { OperationConflictError } from "../../operations/public";

/** Connector effects that require Obsidian UI or an existing narrow transport method. */
export interface SlashCommandControllerOptions {
  sendPrompt: (text: string, attachments?: WsPromptAttachment[]) => Promise<void>;
  sendRawPrompt: (text: string) => Promise<void>;
  renderFeedback: (input: string, guidance: string) => void;
  notify: (message: string) => void;
  isVaultDirectory: (path: string) => boolean;
  normalizeVaultDirectory: (path: string) => string;
  openPermissions: (parsed: SlashParsedCommand) => Promise<void>;
  openMemory: () => void;
  openSubagents: () => void;
  openEvents: () => void;
  openQueries: () => void;
  compact: (parsed: SlashParsedCommand) => Promise<void>;
  createSession: (parsed: SlashParsedCommand) => Promise<void>;
  setWorkingDirectory: (parsed: SlashParsedCommand) => Promise<void>;
  resumeSession: () => Promise<void>;
  forkSession: () => Promise<void>;
  cloneSession: () => Promise<void>;
  reload: () => Promise<void>;
  abort: () => void | Promise<void>;
  bash: (parsed: SlashParsedCommand) => Promise<void>;
  setModel: (parsed: SlashParsedCommand) => Promise<void>;
  setThinking: (parsed: SlashParsedCommand) => Promise<void>;
  exportSession: (kind: "html" | "jsonl", parsed: SlashParsedCommand) => Promise<void>;
  startBackend: () => void | Promise<void>;
  stopBackend: () => void | Promise<void>;
}

/** Renders and dispatches the runtime-owned slash-command read model. */
export class SlashCommandController {
  private runtimeCommands: FrontendLocalCommandViewModel[] = [];

  constructor(private readonly options: SlashCommandControllerOptions) {}

  setRuntimeCommands(commands: readonly FrontendLocalCommandViewModel[]): void {
    const seen = new Set<string>();
    this.runtimeCommands = commands.filter((command) => {
      if (seen.has(command.name)) return false;
      seen.add(command.name);
      return true;
    });
  }

  catalog(): SlashCommandSpec[] {
    return this.runtimeCommands.map((command) => ({
      name: command.name,
      description: command.description,
      usage: usageFor(command),
      source: command.source,
      showInMenu: command.showInMenu,
      argParser: parserFor(command),
      argumentOptions: command.options ? () => command.options ?? [] : undefined,
      surroundingTextPolicy: command.surroundingTextPolicy,
      executionKind: command.source === "local" ? "local" : "dynamic",
      concurrencyKey: command.concurrencyKey,
      execute: (parsed) => this.execute(command, parsed),
    }));
  }

  async submit(plan: SlashSubmitPlan): Promise<void> {
    if (plan.commands.length === 0) {
      await this.options.sendPrompt(plan.text.trim(), plan.attachments);
      return;
    }
    for (const command of plan.commands) {
      const projected = this.runtimeCommands.find((candidate) => candidate.name === command.spec.name);
      if (!projected) {
        this.options.renderFeedback(plan.text.trim(), `/${command.spec.name} is no longer available.`);
        return;
      }
      const guidance = this.guidance(projected, command);
      if (guidance) {
        this.options.renderFeedback(plan.text.trim(), guidance);
        return;
      }
      if (command.spec.surroundingTextPolicy === "forbid" && hasNonWhitespaceOutside(plan.text, command.consumedRange)) {
        this.options.renderFeedback(plan.text.trim(), `/${command.spec.name} must be used by itself. Remove the surrounding text and submit the command again.`);
        return;
      }
    }
    try {
      for (const command of plan.commands) await command.spec.execute?.(command);
    } catch (error) {
      if (error instanceof OperationConflictError) {
        this.options.renderFeedback(plan.text.trim(), error.message);
        return;
      }
      throw error;
    }
    const remaining = removeTextRanges(plan.text, plan.commands.map((command) => command.consumedRange));
    if (remaining.length > 0) await this.options.sendPrompt(remaining, plan.attachments);
  }

  private guidance(model: FrontendLocalCommandViewModel, command: SlashParsedCommand): string | null {
    if (!command.ok) {
      const missing = model.argument.missingLabel ? ` Provide ${model.argument.missingLabel}.` : "";
      return `/${model.name} needs more input before it can run.${missing} ${command.error ?? "Check the command arguments and try again."}`;
    }
    const value = command.args[0]?.trim();
    if (model.validation === "vault-directory" && value && !this.options.isVaultDirectory(this.options.normalizeVaultDirectory(value))) {
      return `"${value}" is not a directory in this vault. Use a vault-relative folder path.`;
    }
    if (model.options && value && !model.options.some((option) => option.value === value)) {
      return `"${value}" is not a supported value for /${model.name}. Choose one from the picker.`;
    }
    return null;
  }

  private async execute(model: FrontendLocalCommandViewModel, parsed: SlashParsedCommand): Promise<void> {
    if (model.retiredReplacement) {
      this.options.notify(`/${model.name} is retired in Chatobby. Use /${model.retiredReplacement} instead.`);
    }
    switch (model.action) {
      case "send-raw-prompt": return this.options.sendRawPrompt(parsed.raw);
      case "open-screen":
        if (model.screenId === "permissions") return this.options.openPermissions(parsed);
        if (model.screenId === "memory") return void this.options.openMemory();
        if (model.screenId === "subagents") return void this.options.openSubagents();
        if (model.screenId === "events") return void this.options.openEvents();
        if (model.screenId === "queries") return void this.options.openQueries();
        return;
      case "compact": return this.options.compact(parsed);
      case "create-session": return this.options.createSession(parsed);
      case "set-working-directory": return this.options.setWorkingDirectory(parsed);
      case "resume-session": return this.options.resumeSession();
      case "fork-session": return this.options.forkSession();
      case "clone-session": return this.options.cloneSession();
      case "reload": return this.options.reload();
      case "abort": return void await this.options.abort();
      case "bash": return this.options.bash(parsed);
      case "set-model": return this.options.setModel(parsed);
      case "set-thinking": return this.options.setThinking(parsed);
      case "export-html": return this.options.exportSession("html", parsed);
      case "export-jsonl": return this.options.exportSession("jsonl", parsed);
      case "start-backend": return void await this.options.startBackend();
      case "stop-backend": return void await this.options.stopBackend();
    }
  }
}

function parserFor(command: FrontendLocalCommandViewModel): SlashCommandSpec["argParser"] {
  if (command.argument.kind === "none") return noArgs();
  if (command.argument.kind === "required-rest") return requiredRestOfLineArg(command.argument.missingLabel ?? "a value");
  if (command.argument.kind === "optional-path") return optionalPathArg();
  if (command.argument.kind === "fixed-whitespace") return fixedWhitespaceArgs(command.argument.count ?? 1);
  return optionalRestOfLineArg();
}

function usageFor(command: FrontendLocalCommandViewModel): string | undefined {
  const label = compactArgumentLabel(command.argument.missingLabel);
  switch (command.argument.kind) {
    case "none": return undefined;
    case "required-rest": return `<${label ?? "value"}>`;
    case "optional-rest": return `[${label ?? "text"}]`;
    case "optional-path": return "[path]";
    case "fixed-whitespace": {
      const count = command.argument.count ?? 1;
      return Array.from({ length: count }, (_, index) => `<${count === 1 ? label ?? "value" : `value-${index + 1}`}>`).join(" ");
    }
  }
}

function compactArgumentLabel(value: string | undefined): string | undefined {
  return value?.trim().replace(/^(?:a|an|the)\s+/iu, "").replace(/\s+/gu, "-");
}
