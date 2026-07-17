import type { FeedStore } from "../../features/feed/public";
import type { FrontendBootstrap } from "../../vendor/chatobby-client/frontend-contracts.js";

const PANEL_KEY = "chatobby-first-run";

export function synchronizeOnboardingPanel(
	store: FeedStore,
	snapshot: FrontendBootstrap,
	onboardingVersion: number,
	providerConfigured: boolean,
): void {
	if (onboardingVersion >= 1) {
		removeOnboardingPanel(store);
		return;
	}
	const providerReady = snapshot.composer.canSubmit || providerConfigured;
	store.dispatch({
		type: "feed.extension-panel-upserted",
		panel: {
			key: PANEL_KEY,
			panelKind: "notice",
			title: "Start with Chatobby",
			source: "Setup",
			body: [
				"1. Runtime: ready.",
				`2. Model provider: ${providerReady ? "connected." : "connect an API key in Chatobby settings."}`,
				"3. Permissions: review the project policy once. The default allows routine work here and asks before external access.",
				"4. Send a message below. Chatobby will show tool progress and ask here whenever approval is needed.",
			].join("\n\n"),
			actions: [
				...(!providerReady
					? [{ id: "setup:settings", label: "Connect provider", icon: "key-round", kind: "primary" as const }]
					: []),
				{ id: "permission:open", label: "Review permissions", icon: "shield-check", kind: "secondary" },
			],
		},
	});
}

export function removeOnboardingPanel(store: FeedStore): void {
	store.dispatch({ type: "feed.extension-panel-removed", key: PANEL_KEY });
}
