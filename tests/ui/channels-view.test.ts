import { readFileSync } from "node:fs";
import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { ChannelsView } from "../../src/features/channels/ui/channels-view";
import type { FrontendChannelScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";

describe("ChannelsView", () => {
  it("keeps participant names in an ellipsized text box under Obsidian button styles", () => {
    const hostStyle = document.createElement("style");
    hostStyle.textContent = "button { display: flex; justify-content: center; }";
    const channelStyle = document.createElement("style");
    channelStyle.textContent = readFileSync("src/features/channels/ui/channels.css", "utf8");
    document.head.append(hostStyle, channelStyle);
    const host = document.body.createDiv();
    const label = "Researcher: compare the findings and prepare the shared project review";
    const model: FrontendChannelScreenViewModel = { ...channelModel(), workspaceWide: true, participants: [{ actorId: "agent-a", label, kind: "subagent", state: "joined", live: true, navigation: { mainSessionId: "session-1", actorId: "agent-a", channelId: "session-channel" } }] };
    const view = new ChannelsView({ app: {} as App, getModel: () => model, subscribe: () => () => {}, onBack: vi.fn(), onRefresh: vi.fn(), onSelectChannel: vi.fn(), onLoadEarlier: vi.fn(), onSetArchived: vi.fn(), onDeleteChannel: vi.fn(), onOpenAgent: vi.fn() });
    try {
      view.render(host);
      const name = host.querySelector<HTMLButtonElement>("button.chatobby-channels__participant-name");
      expect(name?.textContent).toBe(label);
      const style = getComputedStyle(name!);
      expect(style.display).toBe("block");
      expect(style.textOverflow).toBe("ellipsis");
      expect(style.overflow).toBe("hidden");
      expect(style.textAlign).toBe("left");
    } finally {
      view.destroy(); host.remove(); hostStyle.remove(); channelStyle.remove();
    }
  });
  it("retains a separate channel draft through live patches and failed sends, then clears only a successful submission", async () => {
    let model: FrontendChannelScreenViewModel = { ...channelModel(), workspaceWide: true, canCompose: true, participants: [] };
    let changed: ((value: FrontendChannelScreenViewModel) => void) | undefined;
    const send = vi.fn().mockRejectedValueOnce(new Error("Agent is offline")).mockResolvedValue(undefined);
    const view = new ChannelsView({ app: {} as App, getModel: () => model, subscribe: (listener) => { changed = listener; return () => {}; }, onBack: vi.fn(), onRefresh: vi.fn(), onSelectChannel: vi.fn(), onLoadEarlier: vi.fn(), onSetArchived: vi.fn(), onDeleteChannel: vi.fn(), onOpenAgent: vi.fn(), onSendMessage: send });
    const host = document.body.createDiv(); view.render(host);
    const input = (): HTMLTextAreaElement => host.querySelector<HTMLTextAreaElement>("[aria-label='Channel message']")!;
    input().value = "Compare these findings."; input().dispatchEvent(new Event("input", { bubbles: true }));
    model = { ...model, revision: 2 }; changed?.(model);
    expect(input().value).toBe("Compare these findings.");
    model = { ...model, selectedChannelId: "research", revision: 3 }; changed?.(model);
    expect(input().value).toBe("");
    input().value = "Research draft"; input().dispatchEvent(new Event("input", { bubbles: true }));
    model = { ...model, selectedChannelId: "session-channel", revision: 4 }; changed?.(model);
    expect(input().value).toBe("Compare these findings.");
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => expect(host.textContent).toContain("Agent is offline"));
    expect(input().value).toBe("Compare these findings.");
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => expect(input().value).toBe(""));
    expect(send).toHaveBeenCalledWith("session-channel", "Compare these findings.", undefined, undefined);
    model = { ...model, selectedChannelId: "research", revision: 5 }; changed?.(model);
    expect(input().value).toBe("Research draft");
    view.destroy();
  });

  it("renders operator messages, real participant states, and reply addressing without inventing an agent feed", () => {
    const model: FrontendChannelScreenViewModel = { ...channelModel(), workspaceWide: true, canCompose: true, participants: [{ actorId: "agent-a", label: "Evidence researcher", kind: "subagent", state: "invited", live: true }], messages: [{ ...channelModel().messages[0]!, senderLabel: "You", operatorAuthored: true, senderNavigation: undefined, deliveryLabel: "Posted to channel" }] };
    const update = vi.fn(async () => {});
    const view = new ChannelsView({ app: {} as App, getModel: () => model, subscribe: () => () => {}, onBack: vi.fn(), onRefresh: vi.fn(), onSelectChannel: vi.fn(), onLoadEarlier: vi.fn(), onSetArchived: vi.fn(), onDeleteChannel: vi.fn(), onOpenAgent: vi.fn(), onSendMessage: vi.fn(), onSetParticipant: update });
    const host = document.body.createDiv(); view.render(host);
    expect(host.textContent).toContain("invited");
    expect(host.textContent).toContain("Posted to channel");
    expect(host.textContent).not.toContain("Go to agent feed");
    Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Reply")?.click();
    expect(host.textContent).toContain("Replying to You:");
    Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Cancel invite")?.click();
    expect(update).toHaveBeenCalledWith("session-channel", "agent-a", "disconnect");
    view.destroy();
  });
  it("renders runtime-projected directory, routing metadata, and live replacement", async () => {
    let model = channelModel();
    const listeners = new Set<(value: FrontendChannelScreenViewModel | null) => void>();
    const onSetArchived = vi.fn(async () => {});
    const onDeleteChannel = vi.fn(async () => {});
    const app = {
      vault: {
        getAbstractFileByPath: vi.fn(() => null),
        create: vi.fn(async () => ({})),
        modify: vi.fn(async () => {}),
      },
    } as unknown as App;
    const view = new ChannelsView({
      app,
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
    expect(host.querySelectorAll(".chatobby-channels__date-separator")).toHaveLength(1);

    host.querySelector<HTMLButtonElement>(".chatobby-channels__channel")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    host.querySelector<HTMLButtonElement>('[aria-label="Archive channel"]')?.click();
    document.body.querySelector<HTMLButtonElement>(".modal .mod-cta")?.click();
    await Promise.resolve();
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
	document.body.querySelector<HTMLButtonElement>(".modal .mod-cta")?.click();
	await Promise.resolve();
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
    const shellCss = readFileSync("src/ui/shared/page-shell.css", "utf8");
    const hostCss = readFileSync("src/ui/shared/page-shell.css", "utf8");

    expect(shellCss).toContain("container: chatobby-page / inline-size");
    expect(css).toContain("max-width: none");
    expect(css).toContain("@container chatobby-page (max-width: 760px)");
    expect(css).not.toContain("@media (max-width: 620px)");
    expect(hostCss).toMatch(/\.chatobby-page-host\s*\{[^}]*display:\s*flex;/su);
    expect(hostCss).toMatch(/\.chatobby-page-host\s*\{[^}]*flex-direction:\s*column;/su);
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
