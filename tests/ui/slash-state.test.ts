import { describe, expect, it } from "vitest";
import type { SlashActivation, SlashCommandSpec } from "../../src/ui/composer/slash-command";
import { bracketPatternArg, fixedWhitespaceArgs, noArgs, optionalRestOfLineArg } from "../../src/ui/composer/slash-parsers";
import {
  filterSlashCommands,
  findCommandSpec,
  findSlashTokenAtCursor,
  hasNonWhitespaceOutside,
  parseSlashActivations,
  removeTextRanges,
} from "../../src/ui/composer/slash-state";

const commands: SlashCommandSpec[] = [
  {
    name: "new",
    source: "local",
    argParser: noArgs(),
    surroundingTextPolicy: "allow",
    executionKind: "local",
  },
  {
    name: "reload",
    source: "local",
    argParser: noArgs(),
    surroundingTextPolicy: "allow",
    executionKind: "local",
  },
  {
    name: "set-model",
    source: "local",
    argParser: fixedWhitespaceArgs(1),
    surroundingTextPolicy: "allow",
    executionKind: "local",
  },
  {
    name: "compact",
    source: "local",
    argParser: optionalRestOfLineArg(),
    surroundingTextPolicy: "allow",
    executionKind: "local",
  },
  {
    name: "pair",
    source: "local",
    argParser: bracketPatternArg(),
    surroundingTextPolicy: "allow",
    executionKind: "local",
  },
];

describe("slash command state helpers", () => {
  it("detects slash command tokens at the start, middle, and end of text", () => {
    expect(findSlashTokenAtCursor("/new", "/new".length)?.query).toBe("new");
    expect(findSlashTokenAtCursor("before /reload after", "before /rel".length)?.query).toBe("reload");
    expect(findSlashTokenAtCursor("send then /compact", "send then /compact".length)?.query).toBe("compact");
  });

  it("filters suggestions while preserving prefix matches first", () => {
    expect(filterSlashCommands(commands, "re").map((command) => command.name)).toEqual(["reload"]);
    expect(filterSlashCommands(commands, "e").map((command) => command.name).slice(0, 2)).toEqual(["new", "reload"]);
  });

  it("deduplicates command names before displaying suggestions", () => {
    expect(filterSlashCommands([commands[0]!, { ...commands[0]!, source: "extension" }], "new")).toEqual([
      commands[0],
    ]);
  });

  it("returns every command for an empty slash query", () => {
    const manyCommands = Array.from({ length: 12 }, (_, index): SlashCommandSpec => ({
      name: `command-${index.toString().padStart(2, "0")}`,
      source: "local",
      argParser: noArgs(),
      surroundingTextPolicy: "allow",
      executionKind: "local",
    }));

    expect(filterSlashCommands(manyCommands, "")).toHaveLength(manyCommands.length);
  });

  it("hides retired aliases from suggestions while retaining exact command lookup", () => {
    const retired: SlashCommandSpec = {
      name: "memory-insights",
      source: "local",
      showInMenu: false,
      argParser: noArgs(),
      surroundingTextPolicy: "forbid",
      executionKind: "local",
    };
    const catalog = [...commands, retired];

    expect(filterSlashCommands(catalog, "memory")).toEqual([]);
    expect(findCommandSpec(catalog, "memory-insights")).toBe(retired);
  });

  it("parses no-arg, fixed-arg, rest-of-line, and bracket-pattern commands", () => {
    const text = "/new and /set-model gpt-5\n/compact summarize this\n/pair [left|right]";
    const activations: SlashActivation[] = [
      { name: "new", slashStart: 0 },
      { name: "set-model", slashStart: text.indexOf("/set-model") },
      { name: "compact", slashStart: text.indexOf("/compact") },
      { name: "pair", slashStart: text.indexOf("/pair") },
    ];

    const parsed = parseSlashActivations(text, commands, activations);

    expect(parsed.map((command) => command.ok)).toEqual([true, true, true, true]);
    expect(parsed[0]?.args).toEqual([]);
    expect(parsed[1]?.args).toEqual(["gpt-5"]);
    expect(parsed[2]?.args).toEqual(["summarize this"]);
    expect(parsed[3]?.args).toEqual(["[left|right]"]);
  });

  it("marks fixed-arg commands invalid until the required args are present", () => {
    const [parsed] = parseSlashActivations("/set-model ", commands, [{ name: "set-model", slashStart: 0 }]);

    expect(parsed?.ok).toBe(false);
    expect(parsed?.error).toContain("Expected 1 argument");
  });

  it("removes consumed command spans and detects forbidden surrounding text", () => {
    const text = "before /reload after";
    const [parsed] = parseSlashActivations(text, commands, [{ name: "reload", slashStart: text.indexOf("/reload") }]);

    expect(parsed).toBeDefined();
    expect(removeTextRanges(text, parsed ? [parsed.consumedRange] : [])).toBe("before after");
    expect(parsed ? hasNonWhitespaceOutside(text, parsed.consumedRange) : false).toBe(true);
  });
});
