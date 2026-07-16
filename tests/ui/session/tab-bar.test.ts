import { describe, expect, it, vi } from "vitest";
import { TabBar } from "../../../src/ui/session/tab-bar";
import { mount } from "../helpers/mount";

describe("TabBar", () => {
  it("renders page navigation and opens sessions in a new Chatobby view", () => {
		let activeMode: "memory" | "events" = "memory";
		const onCreateView = vi.fn();
		const onNavigate = vi.fn();
		const onReturnToChat = vi.fn();
		const onSetWorkingDirectory = vi.fn();
    const view = new TabBar({
      workingDirectoryLabel: () => "/Projects",
			activeMode: () => activeMode,
			onReturnToChat,
			onCreateView,
			onNavigate,
			onSetWorkingDirectory,
    });

    const element = mount(view);
		const pages = [...element.querySelectorAll<HTMLButtonElement>(".chatobby-tab-bar__page")];
		expect(pages.map((button) => button.getAttribute("aria-label"))).toEqual([
			"Open Subagents",
			"Open Channels",
			"Open Permissions",
			"Open Memory",
			"Open Events",
			"Open Queries",
		]);
		expect(pages.map((button) => button.textContent)).toEqual(["", "", "", "", "", ""]);
		expect(element.querySelector(".chatobby-tab-bar__page-label")).toBeNull();
		expect(element.querySelector("[role='toolbar']")?.getAttribute("aria-label")).toBe("Chatobby view controls");
		expect(element.querySelectorAll(".chatobby-tab-bar__action")).toHaveLength(8);
		expect(element.querySelector<HTMLButtonElement>("[data-mode='memory']")?.getAttribute("aria-pressed")).toBe("true");
		expect(element.querySelector<HTMLButtonElement>("[data-mode='memory']")?.getAttribute("aria-current")).toBe("page");
		element.querySelector<HTMLButtonElement>("[data-mode='events']")?.click();
		expect(onNavigate).toHaveBeenCalledWith("events");
		element.querySelector<HTMLButtonElement>("[aria-label='Open new Chatobby view']")?.click();
		expect(onCreateView).toHaveBeenCalledOnce();
		element.querySelector<HTMLButtonElement>("[aria-label='Set Chatobby working directory']")?.click();
		expect(onSetWorkingDirectory).toHaveBeenCalledOnce();
		activeMode = "events";
		view.refresh();
		expect(element.querySelector<HTMLButtonElement>("[data-mode='events']")?.getAttribute("aria-pressed")).toBe("true");
		expect(element.querySelector<HTMLButtonElement>("[data-mode='memory']")?.hasAttribute("aria-current")).toBe(false);
    expect(element.querySelector(".chatobby-tab-bar__directory")?.textContent).toBe("/Projects");
		element.querySelector<HTMLButtonElement>(".chatobby-tab-bar__directory")?.click();
		expect(onReturnToChat).toHaveBeenCalledOnce();
		expect(element.querySelector("[role='tab']")).toBeNull();
  });
});
