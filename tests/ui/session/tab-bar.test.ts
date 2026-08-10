import { describe, expect, it, vi } from "vitest";
import { TabBar } from "../../../src/ui/session/tab-bar";
import { mount } from "../helpers/mount";

describe("TabBar", () => {
  it("renders page navigation and opens sessions in a new Chatobby view", () => {
		let activeMode: "memory" | "events" = "memory";
		const onCreateView = vi.fn();
		const onNavigate = vi.fn();
		const onReturnToChat = vi.fn();
    const view = new TabBar({
			sessionTitle: () => "Architecture review",
			workspaceLabel: () => "Chatobby",
			activeMode: () => activeMode,
			onReturnToChat,
			onCreateView,
			onNavigate,
    });

    const element = mount(view);
		const pages = [...element.querySelectorAll<HTMLButtonElement>(".chatobby-tab-bar__page")];
		expect(pages.map((button) => button.getAttribute("aria-label"))).toEqual([
			"Open Projects",
			"Open Subagents",
			"Open Channels",
			"Open Permissions",
			"Open Memory",
			"Open Events",
			"Open Queries",
			"Open Plugins",
			"Open Settings",
		]);
		expect(pages.map((button) => button.textContent)).toEqual(["", "", "", "", "", "", "", "", ""]);
		expect(element.querySelector(".chatobby-tab-bar__page-label")).toBeNull();
		expect(element.querySelector("[role='toolbar']")?.getAttribute("aria-label")).toBe("Chatobby view controls");
		expect(element.querySelectorAll(".chatobby-tab-bar__action")).toHaveLength(10);
		expect(element.querySelector<HTMLButtonElement>("[data-mode='memory']")?.getAttribute("aria-pressed")).toBe("true");
		expect(element.querySelector<HTMLButtonElement>("[data-mode='memory']")?.getAttribute("aria-current")).toBe("page");
		element.querySelector<HTMLButtonElement>("[data-mode='memory']")?.click();
		expect(onNavigate).not.toHaveBeenCalled();
		element.querySelector<HTMLButtonElement>("[data-mode='events']")?.click();
		expect(onNavigate).toHaveBeenCalledWith("events");
		element.querySelector<HTMLButtonElement>("[aria-label='Open new Chatobby view']")?.click();
		expect(onCreateView).toHaveBeenCalledOnce();
		activeMode = "events";
		view.refresh();
		expect(element.querySelector<HTMLButtonElement>("[data-mode='events']")?.getAttribute("aria-pressed")).toBe("true");
		expect(element.querySelector<HTMLButtonElement>("[data-mode='memory']")?.hasAttribute("aria-current")).toBe(false);
		expect(element.querySelector(".chatobby-tab-bar__session-title")?.textContent).toBe("Architecture review");
		expect(element.querySelector(".chatobby-tab-bar__workspace-label")?.textContent).toBe("Chatobby");
		element.querySelector<HTMLButtonElement>(".chatobby-tab-bar__directory")?.click();
		expect(onReturnToChat).toHaveBeenCalledOnce();
		expect(element.querySelector("[role='tab']")).toBeNull();
  });
});
