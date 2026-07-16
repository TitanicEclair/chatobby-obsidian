// Tests for the command registry: registration, duplicate guard, Obsidian
// command wiring with shared error handling, and programmatic run().

import { describe, it, expect, vi } from "vitest";
import { CommandRegistry, type ChatobbyAction, type ChatobbyServices } from "../../src/commands/registry";

interface CapturedCommand {
  id: string;
  name: string;
  callback: () => void;
}

function makePlugin(): { plugin: { addCommand(c: CapturedCommand): CapturedCommand }; commands: CapturedCommand[] } {
  const commands: CapturedCommand[] = [];
  const plugin = {
    addCommand(command: CapturedCommand): CapturedCommand {
      commands.push(command);
      return command;
    },
  };
  return { plugin, commands };
}

function makeServices(overrides: Partial<ChatobbyServices> = {}): ChatobbyServices {
  return {
    activateView: vi.fn(async () => {}),
    withView: vi.fn(async () => {}),
    getTransport: vi.fn(() => null),
    backend: { start: vi.fn(async () => {}), stop: vi.fn(async () => {}) },
    cycleModel: vi.fn(async () => {}),
    cycleThinking: vi.fn(async () => {}),
    focusActiveEditor: vi.fn(),
    ...overrides,
  };
}

const action = (id: string, run: ChatobbyAction["run"], group: ChatobbyAction["group"] = "action"): ChatobbyAction => ({
  id,
  name: id,
  group,
  run,
});

describe("CommandRegistry", () => {
  it("registers actions and exposes them via list()", () => {
    const { plugin } = makePlugin();
    const registry = new CommandRegistry(plugin as never, makeServices());
    registry.registerAll([action("a", () => {}), action("b", () => {})]);

    expect(registry.list().map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("rejects duplicate ids", () => {
    const { plugin } = makePlugin();
    const registry = new CommandRegistry(plugin as never, makeServices());
    registry.register(action("a", () => {}));
    expect(() => registry.register(action("a", () => {}))).toThrow(/already registered/);
  });

  it("registerAsObsidianCommands wires each action to addCommand", () => {
    const { plugin, commands } = makePlugin();
    const registry = new CommandRegistry(plugin as never, makeServices());
    registry.registerAll([action("start-backend", () => {}, "backend"), action("open", () => {}, "navigation")]);
    registry.registerAsObsidianCommands();

    expect(commands.map((c) => c.id)).toEqual(["start-backend", "open"]);
    expect(commands[0]!.name).toBe("start-backend");
  });

  it("keeps advanced actions invocable without crowding the command palette", async () => {
    const { plugin, commands } = makePlugin();
    const run = vi.fn(async () => {});
    const registry = new CommandRegistry(plugin as never, makeServices());
    registry.register({ ...action("export-jsonl", run, "capture"), palette: false });
    registry.registerAsObsidianCommands();

    expect(commands).toEqual([]);
    await registry.run("export-jsonl");
    expect(run).toHaveBeenCalledOnce();
  });

  it("invokes the action body when the Obsidian callback fires", async () => {
    const { plugin, commands } = makePlugin();
    const run = vi.fn(async () => {});
    const registry = new CommandRegistry(plugin as never, makeServices());
    registry.register(action("a", run));
    registry.registerAsObsidianCommands();

    commands[0]!.callback();
    await Promise.resolve();
    expect(run).toHaveBeenCalledOnce();
  });

  it("run(id) invokes a registered action programmatically and is a no-op for unknown ids", async () => {
    const { plugin } = makePlugin();
    const run = vi.fn(async () => {});
    const registry = new CommandRegistry(plugin as never, makeServices());
    registry.register(action("a", run));

    await registry.run("a");
    expect(run).toHaveBeenCalledOnce();

    await registry.run("nope"); // unknown — should not throw
    expect(run).toHaveBeenCalledOnce();
  });

  it("wraps action errors so they are caught (no rethrow)", async () => {
    const { plugin } = makePlugin();
    const registry = new CommandRegistry(plugin as never, makeServices());
    registry.register(action("a", async () => {
      throw new Error("boom");
    }));

    // Should resolve, not reject.
    await expect(registry.run("a")).resolves.toBeUndefined();
  });

  it("passes services into the action body", async () => {
    const { plugin } = makePlugin();
    const services = makeServices();
    const registry = new CommandRegistry(plugin as never, services);
    registry.register(action("start", (s) => s.backend.start(), "backend"));

    await registry.run("start");
    expect(services.backend.start).toHaveBeenCalledOnce();
  });
});
