import type { SlashArgParser, SlashArgParseResult, SlashTextRange } from "./slash-command";

export function noArgs(): SlashArgParser {
  return ({ commandRange }) => ({
    ok: true,
    args: [],
    argRanges: [],
    consumedRange: commandRange,
  });
}

export function fixedWhitespaceArgs(count: number): SlashArgParser {
  return ({ text, commandRange }) => {
    const args: string[] = [];
    const argRanges: SlashTextRange[] = [];
    let cursor = commandRange.end;
    let consumedEnd = commandRange.end;

    for (let index = 0; index < count; index += 1) {
      cursor = skipHorizontalWhitespace(text, cursor);
      if (cursor >= text.length || text[cursor] === "\n") {
        return missingArg(commandRange, argRanges, args, count);
      }

      const start = cursor;
      while (cursor < text.length && !isWhitespace(text[cursor]!)) {
        cursor += 1;
      }
      args.push(text.slice(start, cursor));
      argRanges.push({ start, end: cursor });
      consumedEnd = cursor;
    }

    return {
      ok: true,
      args,
      argRanges,
      consumedRange: { start: commandRange.start, end: consumedEnd },
    };
  };
}

export function optionalRestOfLineArg(): SlashArgParser {
  return ({ text, commandRange }) => {
    let start = skipHorizontalWhitespace(text, commandRange.end);
    const lineEnd = findLineEnd(text, start);
    if (start >= lineEnd) {
      return {
        ok: true,
        args: [],
        argRanges: [],
        consumedRange: commandRange,
      };
    }

    const raw = text.slice(start, lineEnd).trimEnd();
    const end = start + raw.length;
    return {
      ok: true,
      args: [raw],
      argRanges: [{ start, end }],
      consumedRange: { start: commandRange.start, end },
    };
  };
}

export function requiredRestOfLineArg(label: string): SlashArgParser {
  return ({ text, commandRange }) => {
    const parsed = optionalRestOfLineArg()({ text, commandRange });
    if (parsed.args.length > 0 && parsed.args[0]?.trim()) return parsed;
    return {
      ok: false,
      args: [],
      argRanges: [],
      consumedRange: commandRange,
      error: `Expected ${label}.`,
    };
  };
}

export function optionalPathArg(): SlashArgParser {
  return optionalRestOfLineArg();
}

export function bracketPatternArg(pattern = /^\[[^\]\n]+\|[^\]\n]+\]/): SlashArgParser {
  return ({ text, commandRange }) => {
    const start = skipHorizontalWhitespace(text, commandRange.end);
    const candidate = text.slice(start);
    const match = candidate.match(pattern);
    if (!match?.[0]) {
      return {
        ok: false,
        args: [],
        argRanges: [],
        consumedRange: commandRange,
        error: "Expected bracket argument.",
      };
    }

    const end = start + match[0].length;
    return {
      ok: true,
      args: [match[0]],
      argRanges: [{ start, end }],
      consumedRange: { start: commandRange.start, end },
    };
  };
}

function missingArg(
  commandRange: SlashTextRange,
  argRanges: SlashTextRange[],
  args: string[],
  count: number,
): SlashArgParseResult {
  return {
    ok: false,
    args,
    argRanges,
    consumedRange: argRanges.length > 0
      ? { start: commandRange.start, end: argRanges[argRanges.length - 1]!.end }
      : commandRange,
    error: `Expected ${count} argument${count === 1 ? "" : "s"}.`,
  };
}

function skipHorizontalWhitespace(text: string, cursor: number): number {
  while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t")) {
    cursor += 1;
  }
  return cursor;
}

function findLineEnd(text: string, cursor: number): number {
  const newline = text.indexOf("\n", cursor);
  return newline === -1 ? text.length : newline;
}

function isWhitespace(value: string): boolean {
  return value === " " || value === "\t" || value === "\n" || value === "\r";
}

