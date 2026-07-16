import { describe, expect, it } from "vitest";
import { ToolItemView } from "../../../../src/ui/feed/tools/tool-item";
import type { ToolItem } from "../../../../src/types";
import { createMockFeedHost } from "../../helpers/mock-host";
import { mount } from "../../helpers/mount";

describe("ToolItemView", () => {
  it("renders a compact row with name, primary arg, status class, and a detail hook", () => {
    const item: ToolItem = {
      id: "tool_1",
      name: "bash",
      category: "bash",
      arguments: JSON.stringify({ command: "echo test" }),
      semanticKind: "shell.command.run",
      displayTitle: "preparing to run command",
      status: "pending",
      isExpanded: false,
    };
    const view = new ToolItemView(createMockFeedHost(), item);
    const el = mount(view);

    expect(el.querySelector(".chatobby-tool-item__row")).toBeTruthy();
    expect(el.querySelector(".chatobby-tool-item__name")?.textContent).toBe("preparing to run command");
    expect(el.querySelector(".chatobby-tool-item__arg")?.textContent).toBe("echo test");
    expect(el.querySelector(".chatobby-tool-item__detail")).toBeTruthy();
    expect(el.classList.contains("is-pending")).toBe(true);

    view.sync({ ...item, displayTitle: "running command", status: "running" });
    expect(el.classList.contains("is-running")).toBe(true);
    expect(el.classList.contains("is-pending")).toBe(false);
    expect(el.querySelector(".chatobby-tool-item__name")?.textContent).toBe("running command");
    expect(el.querySelector(".chatobby-tool-item__status")?.getAttribute("aria-label")).toBe("running command, running");

    view.sync({ ...item, displayTitle: "ran command", status: "succeeded" });
    expect(el.querySelector(".chatobby-tool-item__name")?.textContent).toBe("ran command");
    expect(el.querySelector(".chatobby-tool-item__dot")).toBeNull();
  });

  it("falls back to tool name plus one-line input when no semantic arg is available", () => {
    const item: ToolItem = {
      id: "tool_2",
      name: "custom_tool",
      category: "other",
      arguments: JSON.stringify({ enabled: true, count: 2 }),
      semanticKind: "tool.generic",
      displayTitle: "running tool",
      status: "running",
      isExpanded: false,
    };
    const view = new ToolItemView(createMockFeedHost(), item);
    const el = mount(view);

    expect(el.querySelector(".chatobby-tool-item__name")?.textContent).toBe("running tool");
    expect(el.querySelector(".chatobby-tool-item__arg")?.textContent).toBe("{\"enabled\":true,\"count\":2}");
  });

  it("distinguishes inspection from delegation and exposes failure without color", () => {
    const item: ToolItem = {
      id: "tool_3",
      name: "list_subagents",
      category: "subagent",
      arguments: "{}",
      semanticKind: "agents.inspect",
      displayTitle: "inspecting agents",
      status: "running",
      isExpanded: false,
    };
    const view = new ToolItemView(createMockFeedHost(), item);
    const el = mount(view);

    expect(el.querySelector(".chatobby-tool-item__name")?.textContent).toBe("inspecting agents");
    view.sync({ ...item, displayTitle: "couldn't inspect agents", status: "failed" });
    expect(el.querySelector(".chatobby-tool-item__name")?.textContent).toBe("couldn't inspect agents");
    expect(el.querySelector(".chatobby-tool-item__status")?.getAttribute("title")).toBe("couldn't inspect agents, failed");
    expect(el.querySelector(".chatobby-tool-item__dot")).toBeTruthy();
  });

  it("renders runtime-projected meaning without reclassifying the tool name", () => {
    const item: ToolItem = {
      id: "tool_4",
      name: "opaque-operation",
      semanticKind: "agents.inspect",
      displayTitle: "inspecting agents",
      iconToken: "bot",
      category: "subagent",
      arguments: "{}",
      status: "running",
      isExpanded: false,
    };
    const view = new ToolItemView(createMockFeedHost(), item);
    const el = mount(view);

    expect(el.querySelector(".chatobby-tool-item__name")?.textContent).toBe("inspecting agents");
    view.sync({ ...item, displayTitle: "inspected agents", status: "succeeded" });
    expect(el.querySelector(".chatobby-tool-item__name")?.textContent).toBe("inspected agents");
  });
});
