import { describe, expect, it, vi } from "vitest";
import { createFeedStore, feedSelectors } from "../../src/features/feed/public";
import { routeExtensionPanelAction } from "../../src/ui/controller/extension-panel-action-router";
import {
	removeOnboardingPanel,
	synchronizeOnboardingPanel,
} from "../../src/ui/controller/onboarding-panel-controller";
import type { FrontendBootstrap } from "../../src/vendor/chatobby-client/frontend-contracts.js";

function snapshot(blocks: unknown[] = [], canSubmit = false): FrontendBootstrap {
	return { feed: { blocks }, composer: { canSubmit } } as unknown as FrontendBootstrap;
}

describe("first-run onboarding", () => {
	it("shows setup actions until onboarding is explicitly completed", () => {
		const store = createFeedStore();
		synchronizeOnboardingPanel(store, snapshot(), 0, false);

		const ids = store.select(feedSelectors.orderedBlockIds);
		const panel = ids[0] ? store.select(feedSelectors.blockById(ids[0])) : undefined;
		expect(panel).toMatchObject({
			type: "extension-panel",
			title: "Start with Chatobby",
			actions: [
				{ id: "setup:settings", label: "Connect provider" },
				{ id: "permission:open", label: "Review permissions" },
			],
		});

		removeOnboardingPanel(store);
		expect(store.select(feedSelectors.orderedBlockIds)).toEqual([]);
		synchronizeOnboardingPanel(store, snapshot([{}]), 0, false);
		expect(store.select(feedSelectors.orderedBlockIds)).toHaveLength(1);

		synchronizeOnboardingPanel(store, snapshot([{}]), 1, false);
		expect(store.select(feedSelectors.orderedBlockIds)).toEqual([]);
	});

	it("uses runtime composer readiness when credentials live outside plugin settings", () => {
		const store = createFeedStore();
		synchronizeOnboardingPanel(store, snapshot([], true), 0, false);

		const ids = store.select(feedSelectors.orderedBlockIds);
		const panel = ids[0] ? store.select(feedSelectors.blockById(ids[0])) : undefined;
		expect(panel).toMatchObject({
			type: "extension-panel",
			actions: [{ id: "permission:open", label: "Review permissions" }],
		});
	});

	it("routes setup and permission actions to their native screens", () => {
		const routes = {
			openPermissions: vi.fn(),
			openMemory: vi.fn(),
			openSubagents: vi.fn(),
			openSettings: vi.fn(),
		};
		routeExtensionPanelAction({ id: "setup:settings", label: "Connect" }, routes);
		routeExtensionPanelAction({ id: "permission:open", label: "Permissions" }, routes);

		expect(routes.openSettings).toHaveBeenCalledOnce();
		expect(routes.openPermissions).toHaveBeenCalledOnce();
	});
});
