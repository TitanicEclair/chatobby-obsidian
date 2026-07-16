import type { WsPromptAttachment } from "../../types";

export type SlashCommandSource = "local" | "extension" | "prompt" | "skill";
export type SlashCommandExecutionKind = "local" | "dynamic";
export type SlashCommandSurroundingTextPolicy = "allow" | "forbid";

export interface SlashTextRange {
  start: number;
  end: number;
}

export interface SlashArgParserInput {
  text: string;
  commandRange: SlashTextRange;
}

export interface SlashArgParseResult {
  ok: boolean;
  args: string[];
  argRanges: SlashTextRange[];
  consumedRange: SlashTextRange;
  error?: string;
}

export type SlashArgParser = (input: SlashArgParserInput) => SlashArgParseResult;

export interface SlashArgumentOption {
  value: string;
  label: string;
  description?: string;
}

export interface SlashCommandSpec {
  name: string;
  description?: string;
  source: SlashCommandSource;
  /** False keeps a retired alias executable without advertising it in autocomplete. */
  showInMenu?: boolean;
  argParser: SlashArgParser;
  argumentOptions?: (command: SlashParsedCommand) => readonly SlashArgumentOption[];
  surroundingTextPolicy: SlashCommandSurroundingTextPolicy;
  executionKind: SlashCommandExecutionKind;
  /** Commands sharing a key cannot execute concurrently. Abort has no key by design. */
  concurrencyKey?: "session" | "backend" | "agent-command";
  execute?: (command: SlashParsedCommand) => void | Promise<void>;
}

export interface SlashActivation {
  name: string;
  slashStart: number;
}

export interface SlashParsedCommand {
  spec: SlashCommandSpec;
  commandRange: SlashTextRange;
  consumedRange: SlashTextRange;
  argRanges: SlashTextRange[];
  args: string[];
  raw: string;
  ok: boolean;
  error?: string;
}

export interface SlashSubmitPlan {
  text: string;
  commands: SlashParsedCommand[];
  attachments?: WsPromptAttachment[];
}

export interface SlashToken {
  slashStart: number;
  commandEnd: number;
  query: string;
}

export interface SlashHighlightRange extends SlashTextRange {
  kind: "command" | "arg";
}
