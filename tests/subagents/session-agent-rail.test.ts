import { describe, expect, it, vi } from "vitest";
import { SessionAgentRail } from "../../src/features/subagents/public";
import { mount } from "../ui/helpers/mount";

describe("SessionAgentRail", () => {
  it("renders the main and child agents as accessible tabs without status words", () => {
    const openMainAgent = vi.fn();
    const openAgentFeed = vi.fn();
    const rail = new SessionAgentRail({ openMainAgent, openAgentFeed, openAgentHistory: vi.fn() });
    const element = mount(rail);
    rail.setAgents([
      { actorId: "main", kind: "main", name: "Main", working: true, updatedAt: 3 },
      {
        actorId: "subagent:run-a:node-a",
        kind: "subagent",
        runId: "run-a",
        nodeId: "node-a",
        name: "General purpose",
        working: false,
        updatedAt: 2,
      },
    ]);
    rail.setActiveActor("subagent:run-a:node-a");

    expect(element.textContent).toContain("Main");
    expect(element.textContent).toContain("General purpose");
    expect(element.textContent).not.toContain("ready");
    expect(element.querySelector(".chatobby-session-agent-rail__spinner")).not.toBeNull();
    const buttons = element.querySelectorAll<HTMLButtonElement>(".chatobby-session-agent-rail__item");
    expect(buttons[1]?.getAttribute("aria-current")).toBe("page");
    buttons[1]?.click();
    expect(openAgentFeed).toHaveBeenCalledWith("run-a", "node-a");
    buttons[0]?.click();
    expect(openMainAgent).toHaveBeenCalledOnce();
  });

  it("keeps the selected agent visible when recent history exceeds the rail limit", () => {
    const rail = new SessionAgentRail({
      openMainAgent: vi.fn(),
      openAgentFeed: vi.fn(),
      openAgentHistory: vi.fn(),
    });
    const element = mount(rail);
    rail.setAgents([
      { actorId: "main", kind: "main", name: "Main", working: false, updatedAt: 100 },
      ...Array.from({ length: 13 }, (_, index) => ({
        actorId: `subagent:run-${index}:node-${index}`,
        kind: "subagent" as const,
        runId: `run-${index}`,
        nodeId: `node-${index}`,
        name: `Agent ${index}`,
        working: false,
        updatedAt: 99 - index,
      })),
    ]);
    rail.setActiveActor("subagent:run-12:node-12");

    const buttons = [...element.querySelectorAll<HTMLButtonElement>(".chatobby-session-agent-rail__item")];
    expect(buttons).toHaveLength(12);
    expect(buttons.some((button) => button.textContent === "Agent 12")).toBe(true);
    expect(buttons.find((button) => button.textContent === "Agent 12")?.getAttribute("aria-current")).toBe("page");
    expect(element.querySelector(".chatobby-session-agent-rail__more")).not.toBeNull();
  });
});
