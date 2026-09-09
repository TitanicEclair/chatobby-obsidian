import { describe, expect, it, vi } from "vitest";
import { TabBar } from "../../../src/ui/session/tab-bar";
import { mount } from "../helpers/mount";

describe("TabBar", () => {
  it("keeps session agents mounted in a collapsed dropdown and opens the global page", () => {
    const agents = document.createElement("div");
    const draft = agents.createEl("input"); draft.value = "Keep this agent draft";
    const onNavigate = vi.fn();
    const onReturnToChat = vi.fn();
    const view = new TabBar({
      sessionTitle: () => "Architecture review", workspaceLabel: () => "Research",
      activeMode: () => "chat", onReturnToChat, onCreateView: vi.fn(), onNavigate,
      subagentHost: () => agents,
    });
    const root = mount(view);
    const disclosure = root.querySelector<HTMLDetailsElement>("details")!;
    expect(disclosure.open).toBe(false);
    expect(root.querySelector(".chatobby-tab-bar__pages")).toBeNull();
    disclosure.open = true;
    view.refresh();
    expect(disclosure.contains(draft)).toBe(true);
    expect(draft.value).toBe("Keep this agent draft");
    root.querySelector<HTMLButtonElement>(".chatobby-agent-disclosure__all")!.click();
    expect(onNavigate).toHaveBeenCalledWith("subagents");
    expect(disclosure.open).toBe(false);
    root.querySelector<HTMLButtonElement>(".chatobby-tab-bar__directory")!.click();
    expect(onReturnToChat).toHaveBeenCalledOnce();
  });
});
