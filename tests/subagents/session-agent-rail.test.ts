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
});
