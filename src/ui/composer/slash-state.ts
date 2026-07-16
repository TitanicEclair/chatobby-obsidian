import type {
  SlashActivation,
  SlashCommandSpec,
  SlashHighlightRange,
  SlashParsedCommand,
  SlashTextRange,
  SlashToken,
} from "./slash-command";
import { SLASH_MENU_MAX_SUGGESTIONS } from "../shared/constants";

const COMMAND_CHARS = /^[A-Za-z0-9:_-]$/;

export function findSlashTokenAtCursor(text: string, cursor: number): SlashToken | null {
  if (cursor < 0 || cursor > text.length) return null;

  let start = cursor;
  while (start > 0 && !isTokenBoundary(text[start - 1]!)) {
    start -= 1;
  }
  if (text[start] !== "/") return null;
  if (start > 0 && !isTokenBoundary(text[start - 1]!)) return null;

  let end = start + 1;
  while (end < text.length && COMMAND_CHARS.test(text[end]!)) {
    end += 1;
  }

  if (cursor > end) return null;
  return {
    slashStart: start,
    commandEnd: end,
    query: text.slice(start + 1, end),
  };
}

export function findCommandSpec(commands: readonly SlashCommandSpec[], name: string): SlashCommandSpec | null {
  return commands.find((command) => command.name === name) ?? null;
}

export function filterSlashCommands(commands: readonly SlashCommandSpec[], query: string): SlashCommandSpec[] {
  const normalized = query.toLowerCase();
  const seen = new Set<string>();
  const matches = commands
    .filter((command) => {
      if (seen.has(command.name)) return false;
      seen.add(command.name);
      return command.showInMenu !== false && command.name.toLowerCase().includes(normalized);
    })
    .sort((left, right) => {
      const leftName = left.name.toLowerCase();
      const rightName = right.name.toLowerCase();
      const leftRank = leftName.startsWith(normalized) ? 0 : 1;
      const rightRank = rightName.startsWith(normalized) ? 0 : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return leftName.localeCompare(rightName);
    });

  return normalized ? matches.slice(0, SLASH_MENU_MAX_SUGGESTIONS) : matches;
}

export function parseSlashActivation(
  text: string,
  commands: readonly SlashCommandSpec[],
  activation: SlashActivation,
): SlashParsedCommand | null {
  const spec = findCommandSpec(commands, activation.name);
  if (!spec) return null;

  const commandText = `/${activation.name}`;
  const commandEnd = activation.slashStart + commandText.length;
  if (text.slice(activation.slashStart, commandEnd) !== commandText) return null;
  if (commandEnd < text.length && COMMAND_CHARS.test(text[commandEnd]!)) return null;

  const commandRange = { start: activation.slashStart, end: commandEnd };
  const argResult = spec.argParser({ text, commandRange });
  const raw = text.slice(commandRange.start, argResult.consumedRange.end);
  return {
    spec,
    commandRange,
    consumedRange: argResult.consumedRange,
    argRanges: argResult.argRanges,
    args: argResult.args,
    raw,
    ok: argResult.ok,
    error: argResult.error,
  };
}

export function parseSlashActivations(
  text: string,
  commands: readonly SlashCommandSpec[],
  activations: readonly SlashActivation[],
): SlashParsedCommand[] {
  return activations
    .map((activation) => parseSlashActivation(text, commands, activation))
    .filter((command): command is SlashParsedCommand => command !== null)
    .sort((left, right) => left.commandRange.start - right.commandRange.start);
}

export function toHighlightRanges(commands: readonly SlashParsedCommand[]): SlashHighlightRange[] {
  const ranges: SlashHighlightRange[] = [];
  for (const command of commands) {
    ranges.push({ ...command.commandRange, kind: "command" });
    for (const argRange of command.argRanges) {
      ranges.push({ ...argRange, kind: "arg" });
    }
  }
  return ranges.sort((left, right) => left.start - right.start);
}

export function removeTextRanges(text: string, ranges: readonly SlashTextRange[]): string {
  const ordered = [...ranges].sort((left, right) => right.start - left.start);
  let next = text;
  for (const range of ordered) {
    next = `${next.slice(0, range.start)}${next.slice(range.end)}`;
  }
  return next.replace(/[ \t]{2,}/g, " ").trim();
}

export function hasNonWhitespaceOutside(text: string, range: SlashTextRange): boolean {
  return `${text.slice(0, range.start)}${text.slice(range.end)}`.trim().length > 0;
}

export function rebaseActivations(
  activations: readonly SlashActivation[],
  previousText: string,
  nextText: string,
): SlashActivation[] {
  if (previousText === nextText) return [...activations];

  const prefix = commonPrefixLength(previousText, nextText);
  const suffix = commonSuffixLength(previousText, nextText, prefix);
  const previousEditEnd = previousText.length - suffix;
  const nextEditEnd = nextText.length - suffix;
  const delta = nextEditEnd - previousEditEnd;

  return activations
    .map((activation) => {
      if (activation.slashStart >= previousEditEnd) {
        return { ...activation, slashStart: activation.slashStart + delta };
      }
      if (activation.slashStart >= prefix) return null;
      return activation;
    })
    .filter((activation): activation is SlashActivation => activation !== null);
}

function commonPrefixLength(left: string, right: string): number {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function commonSuffixLength(left: string, right: string, prefix: number): number {
  let count = 0;
  while (
    count + prefix < left.length &&
    count + prefix < right.length &&
    left[left.length - count - 1] === right[right.length - count - 1]
  ) {
    count += 1;
  }
  return count;
}

function isTokenBoundary(value: string): boolean {
  return value === " " || value === "\t" || value === "\n" || value === "\r";
}
