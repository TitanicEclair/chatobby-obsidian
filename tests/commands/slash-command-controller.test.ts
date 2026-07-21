import { describe, expect, it, vi } from "vitest";
import { SlashCommandController, type SlashCommandControllerOptions } from "../../src/features/commands/application/slash-command-controller";
import type { SlashParsedCommand } from "../../src/ui/composer/slash-command";
import { filterSlashCommands } from "../../src/ui/composer/slash-state";
import { OperationConflictError } from "../../src/features/operations/public";
import type { FrontendLocalCommandViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";

function createOptions(): SlashCommandControllerOptions {
  return {
    sendPrompt: vi.fn(async () => {}),
    sendRawPrompt: vi.fn(async () => {}),
    renderFeedback: vi.fn(),
    notify: vi.fn(),
    isVaultDirectory: () => true,
    normalizeVaultDirectory: (path) => path,
    openPermissions: vi.fn(async () => {}),
    openMemory: vi.fn(),
    openSubagents: vi.fn(),
    openEvents: vi.fn(),
    openQueries: vi.fn(),
    compact: vi.fn(async () => {}),
    createSession: vi.fn(async () => {}),
    setWorkingDirectory: vi.fn(async () => {}),
    resumeSession: vi.fn(async () => {}),
    forkSession: vi.fn(async () => {}),
    cloneSession: vi.fn(async () => {}),
    reload: vi.fn(async () => {}),
    abort: vi.fn(),
    bash: vi.fn(async () => {}),
    setModel: vi.fn(async () => {}),
    setThinking: vi.fn(async () => {}),
    exportSession: vi.fn(async () => {}),
    startBackend: vi.fn(async () => {}),
    stopBackend: vi.fn(async () => {}),
  };
}

function command(
  name: string,
  action: FrontendLocalCommandViewModel["action"],
  overrides: Partial<FrontendLocalCommandViewModel> = {},
): FrontendLocalCommandViewModel {
  return {
    name,
    description: `Run ${name}`,
    kind: "runtime",
    source: "local",
    action,
    argument: { kind: "none" },
    surroundingTextPolicy: "forbid",
    showInMenu: true,
    ...overrides,
  };
}

function parsed(spec: ReturnType<SlashCommandController["catalog"]>[number]): SlashParsedCommand {
  return {
    spec,
    commandRange: { start: 0, end: spec.name.length + 1 },
    consumedRange: { start: 0, end: spec.name.length + 1 },
    argRanges: [],
    args: [],
    raw: `/${spec.name}`,
    ok: true,
  };
}

describe("SlashCommandController runtime catalogue", () => {
  it("executes a runtime-projected Events screen command locally", async () => {
    const options = createOptions();
    const controller = new SlashCommandController(options);
    controller.setRuntimeCommands([command("events", "open-screen", { kind: "screen", screenId: "events" })]);
    const spec = controller.catalog()[0]!;
    expect(spec.executionKind).toBe("local");
    await spec.execute?.(parsed(spec));
    expect(options.openEvents).toHaveBeenCalledOnce();
  });

  it("renders exactly the runtime-owned command surface", () => {
    const controller = new SlashCommandController(createOptions());
    controller.setRuntimeCommands([
      command("memory", "open-screen", { kind: "screen", screenId: "memory" }),
      command("custom-extension-command", "send-raw-prompt", { source: "extension" }),
    ]);
    expect(filterSlashCommands(controller.catalog(), "memory").map((entry) => entry.name)).toEqual(["memory"]);
    expect(filterSlashCommands(controller.catalog(), "custom").map((entry) => entry.name)).toEqual([
      "custom-extension-command",
    ]);
  });

  it("projects readable argument syntax from the runtime contract", () => {
    const controller = new SlashCommandController(createOptions());
    controller.setRuntimeCommands([
      command("effort", "set-thinking", {
        argument: { kind: "fixed-whitespace", count: 1, missingLabel: "an effort level" },
      }),
      command("bash", "bash", { argument: { kind: "required-rest", missingLabel: "a command" } }),
    ]);

    expect(controller.catalog()).toMatchObject([
      { name: "effort", usage: "<effort-level>" },
      { name: "bash", usage: "<command>" },
    ]);
  });

  it("keeps the first runtime projection when producers report a duplicate name", () => {
    const controller = new SlashCommandController(createOptions());
    controller.setRuntimeCommands([
      command("permissions", "open-screen", { kind: "screen", screenId: "permissions", showInMenu: true }),
      command("permissions", "send-raw-prompt", { source: "extension" }),
    ]);

    expect(controller.catalog()).toHaveLength(1);
    expect(controller.catalog()[0]).toMatchObject({ name: "permissions", source: "local", executionKind: "local" });
  });

  it("uses runtime-projected retired-alias metadata", async () => {
    const options = createOptions();
    const controller = new SlashCommandController(options);
    controller.setRuntimeCommands([
      command("memory-insights", "open-screen", {
        kind: "screen",
        screenId: "memory",
        retiredReplacement: "memory",
        showInMenu: false,
      }),
    ]);
    const spec = controller.catalog()[0]!;
    await spec.execute?.(parsed(spec));
    expect(options.sendRawPrompt).not.toHaveBeenCalled();
    expect(options.openMemory).toHaveBeenCalledOnce();
    expect(options.notify).toHaveBeenCalledWith("/memory-insights is retired in Chatobby. Use /memory instead.");
  });

  it("does not add aliases or commands beyond the runtime projection", () => {
    const controller = new SlashCommandController(createOptions());
    controller.setRuntimeCommands([
      command("permissions", "open-screen", { kind: "screen", screenId: "permissions" }),
      command("events", "open-screen", { kind: "screen", screenId: "events" }),
    ]);
    expect(controller.catalog().map((entry) => entry.name)).toEqual(["permissions", "events"]);
    expect(controller.catalog().find((entry) => entry.name === "permission-system")).toBeUndefined();
  });

  it("honors producer-owned visibility for skill commands", () => {
    const controller = new SlashCommandController(createOptions());
    controller.setRuntimeCommands([
      command("skill:internal-vault-work", "send-raw-prompt", { source: "skill", showInMenu: false }),
      command("user-extension", "send-raw-prompt", { source: "extension" }),
    ]);
    expect(filterSlashCommands(controller.catalog(), "skill")).toEqual([]);
    expect(filterSlashCommands(controller.catalog(), "user").map((entry) => entry.name)).toEqual(["user-extension"]);
    expect(controller.catalog().find((entry) => entry.name === "skill:internal-vault-work")).toBeDefined();
  });

  it("surfaces a producer-owned operation conflict without keeping its own lock", async () => {
    const options = createOptions();
    options.compact = vi.fn(async () => {
      throw new OperationConflictError({
        key: "session-transition",
        id: "button:new-session",
        label: "Creating session",
        startedAt: Date.now(),
      });
    });
    const controller = new SlashCommandController(options);
    controller.setRuntimeCommands([command("compact", "compact", { concurrencyKey: "session" })]);
    const spec = controller.catalog()[0]!;
    await controller.submit({ text: "/compact", commands: [parsed(spec)] });
    expect(options.compact).toHaveBeenCalledOnce();
    expect(options.renderFeedback).toHaveBeenCalledWith("/compact", "Creating session is already in progress.");
  });

  it("commits the composer only after validation and before a local command begins", async () => {
    const options = createOptions();
    const order: string[] = [];
    options.compact = vi.fn(async () => { order.push("execute"); });
    const controller = new SlashCommandController(options);
    controller.setRuntimeCommands([command("compact", "compact")]);
    const spec = controller.catalog()[0]!;

    await controller.submit(
      { text: "/compact", commands: [parsed(spec)] },
      () => { order.push("accepted"); },
    );

    expect(order).toEqual(["accepted", "execute"]);
  });
});
