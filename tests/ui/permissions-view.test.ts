import { describe, expect, it, vi } from "vitest";
import type { FrontendPermissionScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { PermissionsView, type PermissionViewIntent } from "../../src/ui/permissions/permissions-view";
import { mount } from "./helpers/mount";

describe("PermissionsView", () => {
  it("keeps disclosures open while dispatching runtime-owned capability decisions", async () => {
    let model = permissionModel();
    const listeners = new Set<(value: FrontendPermissionScreenViewModel | null) => void>();
    const onIntent = vi.fn(async (intent: PermissionViewIntent) => {
      model = { ...model, statusMessage: "Capability permission updated." };
      for (const listener of listeners) listener(model);
      expect(intent.type).toBe("permissions.set-capability");
    });
    const view = new PermissionsView({
      getModel: () => model,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onBack: vi.fn(),
    });
    const root = mount(view);
    expect(root.matches(".chatobby-permissions-view.chatobby-page")).toBe(true);
    expect(root.querySelector(".chatobby-permissions__header.chatobby-page__header")).not.toBeNull();
    expect(root.querySelector(".chatobby-permissions__body.chatobby-page__body")).not.toBeNull();
    expect(root.querySelectorAll(".chatobby-permissions__header .chatobby-page__icon-button")).toHaveLength(2);
    const first = root.querySelector<HTMLDetailsElement>(".chatobby-permissions__capability");
    expect(first).not.toBeNull();
    if (!first) return;
    first.open = true;
    first.dispatchEvent(new Event("toggle"));
    first.querySelector<HTMLButtonElement>("[data-decision='deny']")?.click();

    await vi.waitFor(() => expect(onIntent).toHaveBeenCalledWith({
      type: "permissions.set-capability",
      payload: { profileId: "custom", capabilityId: "read", decision: "deny" },
    }));
    expect(root.querySelector<HTMLDetailsElement>(".chatobby-permissions__capability")?.open).toBe(true);
    expect(root.textContent).toContain("Capability permission updated.");
  });

  it("lets an editable policy add a concrete session channel", async () => {
    const model = permissionModel();
    const onIntent = vi.fn(async () => {});
    const view = new PermissionsView({
      getModel: () => model,
      subscribe: () => () => {},
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onBack: vi.fn(),
    });
    const root = mount(view);
    const select = root.querySelector<HTMLSelectElement>('select[aria-label="Channel to add"]');
    if (!select) throw new Error("channel selector missing");
    select.value = "session-1";
    const add = root.querySelector<HTMLButtonElement>(".chatobby-permissions__add-btn");
    add?.click();

    await vi.waitFor(() => expect(onIntent).toHaveBeenCalledWith({
      type: "permissions.add-channel",
      payload: { profileId: "custom", channelId: "session-1" },
    }));
  });
});

function permissionModel(): FrontendPermissionScreenViewModel {
  const profile = {
    id: "custom",
    name: "Custom",
    description: "Custom project policy",
    builtIn: false,
    selected: true,
    activeForMain: true,
    canActivate: false,
    canEdit: true,
    canDelete: false,
    duplicateLabel: "Duplicate",
  };
  return {
    screenId: "permissions",
    revision: 1,
    loading: false,
    selectedProfileId: "custom",
    profiles: [profile],
    selectedProfile: profile,
    capabilityDescription: "Capability groups",
    capabilities: [{
      id: "read",
      label: "Read and inspect",
      description: "Read existing information.",
      countLabel: "1 control",
      decision: { value: "ask", disabled: false },
      targets: [{
        keys: ["read"],
        label: "Read files",
        description: "Read project files.",
        source: "Computer",
        inherited: false,
        decision: { value: "ask", disabled: false },
      }],
    }],
    channelDescription: "Channel controls",
    channels: [],
    availableChannels: [
      { value: "$session", label: "Automatic session channels" },
      { value: "session-1", label: "Lifecycle review" },
    ],
    advancedDescription: "Specific rules override broader choices.",
    advancedGroups: [{ section: "path", label: "Path", placeholder: "Notes/*", disabled: false, rules: [] }],
    storageLines: ["Scope: project"],
  };
}
