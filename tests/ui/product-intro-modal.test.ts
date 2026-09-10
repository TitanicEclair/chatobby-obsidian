import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductIntroduction, ProductIntroModal, selectIntroduction, compareProductVersions } from "../../src/ui/modals/product-intro-modal";

afterEach(() => { document.body.empty(); vi.restoreAllMocks(); });

describe("welcome and release introductions", () => {
  it("welcomes fresh users, shows release notes to existing users, and stays quiet on reload or downgrade", () => {
    expect(selectIntroduction({ onboardingVersion: 0, lastSeenPluginVersion: "" }, "0.5.0")).toBe("welcome");
    expect(selectIntroduction({ onboardingVersion: 1, lastSeenPluginVersion: "" }, "0.5.0")).toBe("changes");
    expect(selectIntroduction({ onboardingVersion: 1, lastSeenPluginVersion: "0.4.3" }, "0.5.0")).toBe("changes");
    expect(selectIntroduction({ onboardingVersion: 1, lastSeenPluginVersion: "0.5.0" }, "0.5.0")).toBeNull();
    expect(selectIntroduction({ onboardingVersion: 1, lastSeenPluginVersion: "0.6.0" }, "0.5.0")).toBeNull();
    expect(selectIntroduction({ onboardingVersion: 1, lastSeenPluginVersion: "0.5.0" }, "0.5.1")).toBe("changes");
    expect(compareProductVersions("0.5.0", "0.5.0-beta.2")).toBeGreaterThan(0);
    expect(compareProductVersions("0.5.0-beta.10", "0.5.0-beta.2")).toBeGreaterThan(0);
  });
  it("offers models and the Guide through Settings with no permission checklist", () => {
    const settings = vi.fn(async () => {}), dismissed = vi.fn();
    const modal = new ProductIntroModal({} as App, "welcome", "0.5.0", "", dismissed, settings);
    modal.open();
    expect(modal.contentEl.textContent).toContain("local model, an API key, or a supported subscription account");
    expect(modal.contentEl.textContent).toContain("Chatobby Guide");
    expect(modal.contentEl.textContent).not.toMatch(/review permissions|permission policy/iu);
    [...modal.contentEl.querySelectorAll("button")].find(b => b.textContent === "Open Settings")!.click();
    expect(settings).toHaveBeenCalledOnce();
    expect(dismissed).toHaveBeenCalledOnce();
  });
  it("separates shipped changes from the roadmap and can reopen current release notes", () => {
    const modal = new ProductIntroModal({} as App, "changes", "0.5.0", "0.5.0", vi.fn(), vi.fn());
    modal.open();
    expect(modal.contentEl.textContent).toContain("Sandboxed tools");
    expect(modal.contentEl.textContent).toContain("Native tabs");
    const roadmap = modal.contentEl.querySelector(".chatobby-intro__roadmap")!;
    expect(roadmap.textContent).toContain("Planned");
    expect(roadmap.textContent).toContain("Session chat annotations");
    expect(roadmap.textContent).toContain("Inline note comments");
    expect(roadmap.querySelectorAll("button")).toHaveLength(0);
    modal.close();
  });
  it("uses a release-notes fallback for a future update without registered highlights", () => {
    const modal = new ProductIntroModal({} as App, "changes", "0.5.3", "0.5.2", vi.fn(), vi.fn());
    modal.open();
    expect(modal.contentEl.textContent).toContain("Open the release notes to see what changed");
    expect(modal.contentEl.textContent).not.toContain("Native tabs and a new sidebar");
    modal.close();
  });
  it("shows the patch highlights without repeating the previous feature release", () => {
    const modal = new ProductIntroModal({} as App, "changes", "0.5.1", "0.5.0", vi.fn(), vi.fn());
    modal.open();
    expect(modal.contentEl.textContent).toContain("Better default web search");
    expect(modal.contentEl.textContent).toContain("More reliable workspace tools");
    expect(modal.contentEl.textContent).not.toContain("Native tabs and a new sidebar");
    expect(modal.contentEl.textContent).not.toContain("A new interface");
    modal.close();
  });
  it("persists dismissal once, avoids duplicate modals and does not acknowledge an unloaded introduction", () => {
    const settings = { onboardingVersion: 1, lastSeenPluginVersion: "0.4.3" };
    const save = vi.fn(async (patch) => { Object.assign(settings, patch); });
    const host = { app: {} as App, version: "0.5.0", getSettings: () => settings, save, openSettings: vi.fn() };
    const opening = vi.spyOn(ProductIntroModal.prototype, "open");
    const intro = new ProductIntroduction(host);
    intro.showInitial(); intro.showInitial();
    expect(opening).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    opening.mock.instances[0]!.close();
    expect(save).toHaveBeenCalledExactlyOnceWith({ onboardingVersion: 1, lastSeenPluginVersion: "0.5.0" });
    intro.showInitial();
    expect(opening).toHaveBeenCalledOnce();
    intro.show(); intro.dispose();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
