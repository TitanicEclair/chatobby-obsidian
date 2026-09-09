import { describe, expect, it, vi } from "vitest";
import { createFeedStore, feedSelectors } from "../../src/features/feed/public";
import { routeExtensionPanelAction } from "../../src/ui/controller/extension-panel-action-router";
import { removeOnboardingPanel } from "../../src/ui/controller/onboarding-panel-controller";

describe("retired first-run feed panel", () => {
  it("removes a retained setup panel without affecting other extension panels", () => {
    const store = createFeedStore();
    for (const key of ["chatobby-first-run", "keep"]) store.dispatch({ type: "feed.extension-panel-upserted", panel: {
      key, panelKind: "notice", title: key, source: "Test", body: "Retained panel", actions: [],
    } });
    removeOnboardingPanel(store);
    const ids = store.select(feedSelectors.orderedBlockIds);
    expect(ids).toHaveLength(1);
    expect(store.select(feedSelectors.blockById(ids[0]!))).toMatchObject({ title: "keep" });
  });
  it("preserves setup and permission action routing for other panels", () => {
    const routes = { openPermissions: vi.fn(), openMemory: vi.fn(), openSubagents: vi.fn(), openSettings: vi.fn() };
    routeExtensionPanelAction({ id: "setup:settings", label: "Connect" }, routes);
    routeExtensionPanelAction({ id: "permission:open", label: "Permissions" }, routes);
    expect(routes.openSettings).toHaveBeenCalledOnce();
    expect(routes.openPermissions).toHaveBeenCalledOnce();
  });
});
