import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ChannelsView } from "../../src/features/channels/ui/channels-view";
import type { FrontendChannelScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";

describe("ChannelsView", () => {
  it("renders runtime-projected directory, routing metadata, and live replacement", () => {
    let model = channelModel();
    const listeners = new Set<(value: FrontendChannelScreenViewModel | null) => void>();
    const onSetArchived = vi.fn(async () => {});
    const onDeleteChannel = vi.fn(async () => {});
    const view = new ChannelsView({
      getModel: () => model,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      onBack: vi.fn(),
      onRefresh: vi.fn(async () => {}),
      onSelectChannel: vi.fn(async () => {}),
      onLoadEarlier: vi.fn(async () => {}),
      onOpenAgent: vi.fn(async () => {}),
      onSetArchived,
      onDeleteChannel,
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    view.render(host);

    expect(host.querySelector(".chatobby-channels.chatobby-page")).not.toBeNull();
    expect(host.querySelector(".chatobby-channels__header.chatobby-page__header")).not.toBeNull();
    expect(host.querySelectorAll(".chatobby-channels__header .chatobby-page__icon-button")).toHaveLength(2);
    expect(host.querySelector("aside[aria-label='Channel list']")).not.toBeNull();
    expect(host.querySelectorAll(".chatobby-channels__channel")).toHaveLength(2);
    expect([...host.querySelectorAll(".chatobby-channels__section-label")].map((element) => element.textContent)).toEqual([
      "Current",
      "Channels",
    ]);
    expect(host.querySelector(".chatobby-channels__channel.is-active")?.textContent).toContain("Lifecycle review");
    expect(host.querySelector(".chatobby-channels__conversation-heading")?.textContent).toContain("Lifecycle review");
    expect(host.querySelector(".chatobby-channels__conversation-heading")?.textContent).toContain("C:\\Vault\\Projects\\Chatobby");
    expect(host.querySelector(".chatobby-channels__message-meta")?.textContent).toContain("Main");
    expect(host.querySelector(".chatobby-channels__message-route")?.textContent).toBe("to Researcher");
    expect(host.querySelector(".chatobby-channels__bubble")?.textContent).toContain("Status update");
    expect(host.querySelector(".chatobby-channels__message-context")?.textContent).toContain("Directory: C:\\Vault\\Projects\\Chatobby");

    Object.defineProperty(window, "confirm", { configurable: true, value: vi.fn(() => true) });
    host.querySelector<HTMLButtonElement>('[aria-label="Archive channel"]')?.click();
    expect(onSetArchived).toHaveBeenCalledWith("session-channel", true);

	model = {
		...model,
		revision: 2,
		groups: model.groups.map((group) => ({
			...group,
			items: group.items.map((item) => item.id === "session-channel"
				? { ...item, archived: true, canArchive: false, canDelete: true }
				: item),
		})),
	};
	for (const listener of listeners) listener(model);
	host.querySelector<HTMLButtonElement>('[aria-label="Delete channel permanently"]')?.click();
	expect(onDeleteChannel).toHaveBeenCalledWith("session-channel");

    model = { ...model, revision: 3, messages: [...model.messages, {
      ...model.messages[0]!,
      id: "message-2",
      order: 2,
      senderLabel: "Researcher",
      senderInitials: "R",
      recipientLabel: "to Main",
      kindLabel: "Result",
      text: "Live result",
    }] };
    for (const listener of listeners) listener(model);
    expect(host.querySelectorAll(".chatobby-channels__message")).toHaveLength(2);
    expect(host.textContent).toContain("Live result");
    view.destroy();
  });

  it("uses pane-width container breakpoints instead of window-width media queries", () => {
    const css = readFileSync("src/features/channels/ui/channels.css", "utf8");
    const hostCss = readFileSync("src/ui/session/session-picker.css", "utf8");

    expect(css).toContain("container: chatobby-channels / inline-size");
    expect(css).toContain("max-width: none");
    expect(css).toContain("@container chatobby-channels (max-width: 700px)");
    expect(css).not.toContain("@media (max-width: 620px)");
    expect(hostCss).toMatch(/\.chatobby-session-picker-host\s*\{[^}]*display:\s*flex;/su);
    expect(hostCss).toMatch(/\.chatobby-session-picker-host\s*\{[^}]*flex-direction:\s*column;/su);
    expect(hostCss).toMatch(/button\.chatobby-session-picker__item-open\s*\{[^}]*background:\s*transparent;/su);
    expect(hostCss).toMatch(/button\.chatobby-session-picker__item-open\s*\{[^}]*border-radius:\s*0;/su);
  });
});

function channelModel(): FrontendChannelScreenViewModel {
  return {
    screenId: "channels",
    revision: 1,
    loading: false,
    groups: [
      {
        id: "current",
        label: "Current",
        items: [{
          id: "session-channel",
          label: "Lifecycle review",
          subtitle: "1 message · 1 active",
          iconToken: "users",
          selected: true,
          archived: false,
          canArchive: true,
          canDelete: false,
        }],
      },
      {
        id: "named",
        label: "Channels",
        items: [{
          id: "research",
          label: "Research group",
          subtitle: "0 active",
          iconToken: "messages-square",
          selected: false,
          archived: false,
          canArchive: true,
          canDelete: false,
        }],
      },
    ],
    selectedChannelId: "session-channel",
    heading: "Lifecycle review",
    subheading: "Session · C:\\Vault\\Projects\\Chatobby",
    messages: [{
      id: "message-1",
      order: 1,
      senderLabel: "Main",
      senderInitials: "M",
      recipientLabel: "to Researcher",
      kindLabel: "Request",
      text: "Status update",
      createdAt: Date.now(),
      contextLabel: "Session: Lifecycle review · Directory: C:\\Vault\\Projects\\Chatobby",
      senderNavigation: { mainSessionId: "session-1", actorId: "main:session-1", channelId: "session-channel" },
    }],
  };
}
