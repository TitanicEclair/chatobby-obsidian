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
    expect(element.querySelector(".chatobby-session-agent-rail__more")?.hasClass("is-hidden")).toBe(false);
    buttons[1]?.click();
    expect(openAgentFeed).toHaveBeenCalledWith("run-a", "node-a");
    buttons[0]?.click();
    expect(openMainAgent).toHaveBeenCalledOnce();
  });

  it("updates lifecycle indicators in place without moving existing agent tabs", () => {
    const rail = new SessionAgentRail({
      openMainAgent: vi.fn(),
      openAgentFeed: vi.fn(),
      openAgentHistory: vi.fn(),
    });
    const element = mount(rail);
    rail.setAgents([
      { actorId: "main", kind: "main", name: "Main", working: false, updatedAt: 100 },
      {
        actorId: "subagent:run-a:node-a",
        kind: "subagent",
        runId: "run-a",
        nodeId: "node-a",
        name: "Research",
        working: false,
        updatedAt: 10,
      },
      {
        actorId: "subagent:run-b:node-b",
        kind: "subagent",
        runId: "run-b",
        nodeId: "node-b",
        name: "Review",
        working: false,
        updatedAt: 9,
      },
    ]);
    const research = element.querySelector<HTMLButtonElement>("[data-actor-id='subagent:run-a:node-a']");
    const initialOrder = [...element.querySelectorAll<HTMLButtonElement>(".chatobby-session-agent-rail__item")]
      .map((button) => button.dataset.actorId);

    rail.setAgents([
      { actorId: "main", kind: "main", name: "Main", working: true, updatedAt: 100 },
      {
        actorId: "subagent:run-b:node-b",
        kind: "subagent",
        runId: "run-b",
        nodeId: "node-b",
        name: "Review",
        working: true,
        updatedAt: 30,
      },
      {
        actorId: "subagent:run-a:node-a",
        kind: "subagent",
        runId: "run-a",
        nodeId: "node-a",
        name: "Research",
        working: true,
        updatedAt: 20,
      },
    ]);

    expect(element.querySelector("[data-actor-id='subagent:run-a:node-a']")).toBe(research);
    expect(
      [...element.querySelectorAll<HTMLButtonElement>(".chatobby-session-agent-rail__item")]
        .map((button) => button.dataset.actorId),
    ).toEqual(initialOrder);
    expect(research?.querySelector(".chatobby-session-agent-rail__spinner")).not.toBeNull();
    expect(research?.getAttribute("aria-label")).toBe("Research, working");
  });

  it("retains the selected child as an idle navigation tab after it leaves the live projection", () => {
    const openMainAgent = vi.fn();
    const rail = new SessionAgentRail({
      openMainAgent,
      openAgentFeed: vi.fn(),
      openAgentHistory: vi.fn(),
    });
    const element = mount(rail);
    rail.setAgents([
      { actorId: "main", kind: "main", name: "Main", working: false, updatedAt: 100 },
      {
        actorId: "subagent:run-a:node-a",
        kind: "subagent",
        runId: "run-a",
        nodeId: "node-a",
        name: "Research",
        working: true,
        updatedAt: 10,
      },
    ]);
    rail.setActiveActor("subagent:run-a:node-a");
    rail.setAgents([{ actorId: "main", kind: "main", name: "Main", working: false, updatedAt: 100 }]);

    const retained = element.querySelector<HTMLButtonElement>("[data-actor-id='subagent:run-a:node-a']");
    expect(element.hasClass("is-hidden")).toBe(false);
    expect(retained?.textContent).toBe("Research");
    expect(retained?.querySelector(".chatobby-session-agent-rail__spinner")).toBeNull();
    expect(retained?.getAttribute("aria-current")).toBe("page");

    rail.setActiveActor("main");
    expect(element.querySelector("[data-actor-id='subagent:run-a:node-a']")).toBeNull();
    expect(element.hasClass("is-hidden")).toBe(true);
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

  it("supports arrow navigation and searchable overflow without replacing the rail", () => {
    const openMainAgent = vi.fn();
    const openAgentFeed = vi.fn();
    const openAgentHistory = vi.fn();
    const rail = new SessionAgentRail({ openMainAgent, openAgentFeed, openAgentHistory });
    const element = mount(rail);
    rail.setAgents([
      { actorId: "main", kind: "main", name: "Main", working: false, updatedAt: 100 },
      ...Array.from({ length: 13 }, (_, index) => ({
        actorId: `subagent:run-${index}:node-${index}`,
        kind: "subagent" as const,
        runId: `run-${index}`,
        nodeId: `node-${index}`,
        name: `Research agent ${index}`,
        working: index === 0,
        updatedAt: 99 - index,
      })),
    ]);

    const main = element.querySelector<HTMLButtonElement>("[data-actor-id='main']");
    main?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(openAgentFeed).toHaveBeenCalledWith("run-0", "node-0");

    element.querySelector<HTMLButtonElement>(".chatobby-session-agent-rail__more")?.click();
    const search = element.querySelector<HTMLInputElement>(".chatobby-session-agent-rail__search");
    expect(search).not.toBeNull();
    if (!search) return;
    search.value = "12";
    search.dispatchEvent(new Event("input"));
    expect(element.querySelectorAll(".chatobby-session-agent-rail__overflow-item")).toHaveLength(1);
    expect(element.textContent).toContain("Research agent 12");
    element.querySelector<HTMLButtonElement>(".chatobby-session-agent-rail__history")?.click();
    expect(openAgentHistory).toHaveBeenCalledOnce();
    expect(element.querySelector(".chatobby-session-agent-rail__overflow")).toBeNull();
  });
});
