import { describe, expect, it, vi } from "vitest";
import type { FrontendPermissionScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { PermissionsView, type PermissionViewIntent } from "../../src/ui/permissions/permissions-view";
import { mount } from "./helpers/mount";

describe("PermissionsView", () => {
  it("renders a mixed-version permission model with omitted collection fields", () => {
    const current = permissionModel();
    const {
      liveAgents: _liveAgents,
      channels: _channels,
      availableChannels: _availableChannels,
      storageLines: _storageLines,
      ...legacy
    } = current;
    const model = legacy as unknown as FrontendPermissionScreenViewModel;
    const view = new PermissionsView({
      getModel: () => model,
      subscribe: () => () => {},
      onRefresh: vi.fn(async () => {}),
      onIntent: vi.fn(async () => {}),
      onBack: vi.fn(),
    });

    const root = mount(view);

    expect(root.textContent).toContain("Permission policy");
    expect(root.textContent).toContain("This policy does not have access to any channels.");
  });

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

  it("preserves the page scroll position while a permission change rerenders", async () => {
    let model = permissionModel();
    const listeners = new Set<(value: FrontendPermissionScreenViewModel | null) => void>();
    const view = new PermissionsView({
      getModel: () => model,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      onRefresh: vi.fn(async () => {}),
      onIntent: vi.fn(async () => {
        model = { ...model, statusMessage: "Saved." };
        for (const listener of listeners) listener(model);
      }),
      onBack: vi.fn(),
    });
    const root = mount(view);
    const body = root.querySelector<HTMLElement>(".chatobby-permissions__body");
    if (!body) throw new Error("permission body missing");
    body.scrollTop = 420;

    root.querySelector<HTMLButtonElement>("[data-decision='deny']")?.click();

    await vi.waitFor(() => expect(root.textContent).toContain("Saved."));
    expect(root.querySelector<HTMLElement>(".chatobby-permissions__body")?.scrollTop).toBe(420);
  });

  it("changes one active agent policy with its exact binding revision", async () => {
    const base = permissionModel();
    const model: FrontendPermissionScreenViewModel = {
      ...base,
      liveAgents: [{
        authority: {
          kind: "subagent",
          mainSessionId: "main-1",
          runId: "run-1",
          nodeId: "node-1",
        },
        label: "Subagent node-1",
        detail: "Run run-1",
        audience: "child",
        profileId: "custom",
        bindingRevision: 7,
      }],
    };
    const onIntent = vi.fn(async () => {});
    const view = new PermissionsView({
      getModel: () => model,
      subscribe: () => () => {},
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onBack: vi.fn(),
    });
    const root = mount(view);
    const select = root.querySelector<HTMLSelectElement>('select[aria-label="Subagent node-1 permission policy"]');
    if (!select) throw new Error("live agent policy selector missing");
    select.value = "standard";
    select.dispatchEvent(new Event("change"));

    await vi.waitFor(() => expect(onIntent).toHaveBeenCalledWith({
      type: "permissions.set-live-agent-profile",
      payload: {
        authority: {
          kind: "subagent",
          mainSessionId: "main-1",
          runId: "run-1",
          nodeId: "node-1",
        },
        profileId: "standard",
        expectedBindingRevision: 7,
      },
    }));
  });

  it("uses the selected policy for the live main agent instead of only changing the project default", async () => {
    const base = permissionModel();
    const model: FrontendPermissionScreenViewModel = {
      ...base,
      selectedProfileId: "standard",
      selectedProfile: { ...base.profiles[1]!, selected: true, activeForMain: false, canActivate: true },
      profiles: [
        { ...base.profiles[0]!, selected: false, activeForMain: true, canActivate: false },
        { ...base.profiles[1]!, selected: true, activeForMain: false, canActivate: true },
      ],
      liveAgents: [{
        authority: { kind: "main", mainSessionId: "main-1" },
        label: "Main agent",
        detail: "main-1",
        audience: "main",
        profileId: "custom",
        bindingRevision: 11,
      }],
    };
    const onIntent = vi.fn(async () => {});
    const view = new PermissionsView({
      getModel: () => model,
      subscribe: () => () => {},
      onRefresh: vi.fn(async () => {}),
      onIntent,
      onBack: vi.fn(),
    });
    const root = mount(view);
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Use for Main")
      ?.click();

    await vi.waitFor(() => expect(onIntent).toHaveBeenCalledWith({
      type: "permissions.set-live-agent-profile",
      payload: {
        authority: { kind: "main", mainSessionId: "main-1" },
        profileId: "standard",
        expectedBindingRevision: 11,
      },
    }));
  });

	it("deletes an active custom policy only after choosing its replacement", async () => {
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
		root.querySelector<HTMLButtonElement>('button[aria-label="Delete profile"]')?.click();
		const replacement = root.querySelector<HTMLSelectElement>('select[aria-label="Replacement permission policy"]');
		const remove = [...root.querySelectorAll<HTMLButtonElement>("button")]
			.find((button) => button.textContent === "Delete policy");
		expect(replacement).not.toBeNull();
		expect(remove?.disabled).toBe(true);
		if (!replacement || !remove) return;
		replacement.value = "standard";
		replacement.dispatchEvent(new Event("change"));
		expect(replacement.value).toBe("standard");
		expect(remove.disabled).toBe(false);
		remove.click();

		await vi.waitFor(() => expect(onIntent).toHaveBeenCalledWith({
			type: "permissions.delete-profile",
			payload: { profileId: "custom", replacementProfileId: "standard" },
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
	canDelete: true,
	deleteReplacementRequired: true,
	deleteImpactLabel: "Currently used by Main agent. Choose a replacement.",
    duplicateLabel: "Duplicate",
  };
	const standard = {
		...profile,
		id: "standard",
		name: "Standard",
		description: "Built-in safeguards",
		builtIn: true,
		selected: false,
		activeForMain: false,
		canActivate: true,
		canEdit: false,
		canDelete: false,
		deleteReplacementRequired: false,
		deleteImpactLabel: undefined,
		duplicateLabel: "Customize",
	};
  return {
    screenId: "permissions",
    revision: 1,
	profileRevision: 1,
    loading: false,
    selectedProfileId: "custom",
    profiles: [profile, standard],
    selectedProfile: profile,
    liveAgents: [],
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
