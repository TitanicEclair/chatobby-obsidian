import { describe, expect, it, vi } from "vitest";
import type { FrontendPermissionScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import {
  PermissionsView,
  type PermissionViewIntent,
} from "../../src/ui/permissions/permissions-view";
import { mount } from "./helpers/mount";

describe("PermissionsView", () => {
  it("replaces sandbox settings with Full access and retains independent workspace app grants", () => {
    const model = permissionModel({ executionMode: "full-access", accessPolicy: { schemaVersion: 1, revision: 7, accessMode: "full", agentNetworkAccess: true },
      workspaceVaultAccess: [{ projectId: "project-one", projectRevision: 4, label: "Research", revision: 7, enabled: false, source: "user" }] });
    const root = mount(new PermissionsView({ workspacePage: true, getModel: () => model, getActiveSessionId: () => model.accessPolicySessionId,
      supportsObsidianVaultAccess: () => true, supportsNativeSetup: () => true, subscribe: () => () => {}, onIntent: vi.fn(), onRefresh: async () => {}, onBack: () => {} }));
    expect(root.textContent).toContain("Sandboxing is temporarily unavailable");
    expect(root.textContent).toContain("including outside this vault");
    expect(root.textContent).toContain("session searches stay scoped");
    expect(root.textContent).not.toContain("Review verification");
    expect(root.textContent).not.toContain("Choose Read-only");
    expect(root.querySelectorAll("input[type='radio']")).toHaveLength(0);
    expect(root.querySelectorAll("input[type='checkbox']")).toHaveLength(1);
    expect(root.querySelector<HTMLInputElement>("input[aria-label='Obsidian access for Research']")?.checked).toBe(false);
  });
  it("shows named workspace grants without an unrelated session's mode controls", async () => {
    const model = permissionModel({ workspaceVaultAccess: [{ projectId: "project-one", projectRevision: 4, label: "Research", revision: 7, enabled: false, source: "default" }] });
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const root = mount(new PermissionsView({ workspacePage: true, getModel: () => model, getActiveSessionId: () => model.accessPolicySessionId,
      supportsObsidianVaultAccess: () => true, subscribe: () => () => {}, onIntent, onRefresh: async () => {}, onBack: () => {} }));
    expect(root.querySelectorAll("input[type='radio']")).toHaveLength(0);
    expect(root.textContent).not.toContain("Off · Default");
    expect(root.textContent).not.toContain("Your choice");
    const toggle = root.querySelector<HTMLInputElement>("input[aria-label='Obsidian access for Research']")!;
    toggle.checked = true; toggle.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(onIntent).toHaveBeenCalledWith({ type: "permissions.set-workspace-vault-access", payload: { projectId: "project-one", expectedProjectRevision: 4, expectedRevision: 7, enabled: true } }));
  });
  it.each(["ready", "unverified", "unsupported"] as const)("identifies Landstrip and the actual projected %s state", (status) => {
    const value = permissionModel();
    const root = mount(createView(permissionModel({
      nativeSupport: { status, backendId: "landstrip", reason: "Runtime observation detail.", userAction: "Review installed verification." },
      effective: { ...value.effective, fileRead: status === "ready", localProcess: status === "ready" ? "native-contained" : "unavailable" },
    })));
    expect(root.textContent).not.toContain("Landstrip");
    expect(root.textContent).not.toContain("macOS Seatbelt");
    expect(root.textContent).not.toContain("Windows AppContainer");
    expect(root.textContent).not.toContain("Runtime observation detail.");
    expect(root.textContent).not.toContain("Review installed verification.");
    expect(root.textContent?.includes("Workspace protection could not start")).toBe(status !== "ready");
    expect(root.textContent).toContain(status === "ready" ? "FilesRead only" : "FilesUnavailable");
  });

  it.each([
    ["windows-appcontainer", "Windows AppContainer"],
    ["linux-bubblewrap", "Linux bubblewrap"],
    ["macos-seatbelt", "macOS Seatbelt"],
  ] as const)("keeps the explicit legacy backend label for %s", (backendId, label) => {
    const root = mount(createView(permissionModel({ nativeSupport: { status: "unverified", backendId } })));
    expect(root.textContent).toContain(label);
    expect(root.textContent).not.toContain("Workspace protection is ready");
  });

  it("describes Read-only processes without implying they can change selected files", () => {
    const value = permissionModel();
    const root = mount(createView(permissionModel({ effective: { ...value.effective, localProcess: "native-contained" } })));
    expect(root.textContent).toContain("Read files inside the selected working roots without changing them");
    expect(root.textContent).toContain("Local processes require a ready native backend and keep selected roots read-only");
    expect(root.textContent).not.toContain("File changes and local processes stay unavailable");
    expect(root.textContent).toContain("Local processesWorkspace-restricted by the ready native backend");
  });

  it.each(["project", "vault"] as const)("explains current-session settings separately from the %s app grant", (kind) => {
    const value = permissionModel();
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const root = mount(createView(permissionModel({ scope: { ...value.scope, kind } }), onIntent));
    expect(root.textContent).toContain("Access mode and agent network belong to this saved chat and are kept when you reopen it");
    expect(root.textContent).toContain("Other independent chats, including chats in the same Project, keep their own settings");
    expect(root.textContent).toContain("Tabs showing this same chat share its settings");
    expect(root.textContent).toContain("This network setting applies to this chat. New chats start with network On");
    expect(root.textContent).not.toContain("installation-wide");
    expect(root.textContent).toContain(`for this chat's ${kind === "project" ? "Project" : "Vault"}`);
    expect(root.textContent).toContain("This switch applies only to the current Project or Vault, not the whole installation");
    expect(root.textContent).toContain("Project roots, memory scope, and identity do not change");
    expect(root.textContent).toContain("MCP servers and tools still need their separate switches");
    expect(root.querySelectorAll("input[type='radio']")).toHaveLength(3);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it.each(["not-negotiated", "no-grant"] as const)("keeps the new control unavailable without both canonical prerequisites: %s", (missing) => {
    const onIntent = vi.fn(async () => {});
    const model = permissionModel(missing === "no-grant" ? { obsidianVaultAccess: undefined } : {});
    const root = mount(new PermissionsView({ getModel: () => model, getActiveSessionId: () => model.accessPolicySessionId, supportsObsidianVaultAccess: () => missing !== "not-negotiated",
      subscribe: () => () => {}, onIntent, onRefresh: async () => {}, onBack: () => {} }));
    const toggle = root.querySelector<HTMLInputElement>("input[aria-label='Allow Obsidian vault access']");
    expect(toggle?.disabled).toBe(true);
    expect(root.textContent).toContain("Unavailable");
    expect(root.textContent).not.toContain("Your explicit choice");
    toggle?.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onIntent).not.toHaveBeenCalled();
  });

  it("rechecks negotiation when a previously enabled control is clicked after disconnect", () => {
    const onIntent = vi.fn(async () => {});
    let supported = true;
    const root = mount(new PermissionsView({ getModel: () => permissionModel(), getActiveSessionId: () => "synthetic-session", supportsObsidianVaultAccess: () => supported,
      subscribe: () => () => {}, onIntent, onRefresh: async () => {}, onBack: () => {} }));
    const toggle = root.querySelector<HTMLInputElement>("input[aria-label='Allow Obsidian vault access']");
    supported = false;
    toggle?.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onIntent).not.toHaveBeenCalled();
  });

  it.each(["disconnected", "loading", "unavailable"] as const)("does not present cached effective app authority as current while %s", (state) => {
    const base = permissionModel();
    const model = permissionModel({
      loading: state === "loading",
      effective: { ...base.effective, obsidian: "app-authority" },
      obsidianVaultAccess: state === "unavailable"
        ? { status: "unavailable", enabled: false, warning: "Uses Obsidian’s app authority outside the sandbox.", reason: "Target unavailable." }
        : { status: "available", revision: 31, enabled: true, sessionId: "synthetic-session", bindingRevision: 4, source: "user", warning: "Uses Obsidian’s app authority outside the sandbox." },
    });
    const root = mount(new PermissionsView({ getModel: () => model, getActiveSessionId: () => model.accessPolicySessionId, supportsObsidianVaultAccess: () => state !== "disconnected",
      subscribe: () => () => {}, onIntent: async () => {}, onRefresh: async () => {}, onBack: () => {} }));
    expect(root.textContent).toContain("ObsidianUnavailable");
    expect(root.textContent).not.toContain("ObsidianObsidian app authority");
  });

  it.each([
    { accessMode: "read-only", agentNetworkAccess: false },
    { accessMode: "read-only", agentNetworkAccess: true },
    { accessMode: "workspace", agentNetworkAccess: false },
    { accessMode: "workspace", agentNetworkAccess: true },
    { accessMode: "full", agentNetworkAccess: true },
  ] as const)("offers the independent app-authority switch in $accessMode / network $agentNetworkAccess", async (policy) => {
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const model = permissionModel({ accessPolicy: { schemaVersion: 1, revision: 7, ...policy } });
    const root = mount(createView(model, onIntent));
    const toggle = root.querySelector<HTMLInputElement>("input[aria-label='Allow Obsidian vault access']");
    expect(toggle?.checked).toBe(false);
    expect(toggle?.disabled).toBe(false);
    expect(root.querySelectorAll("input[type='radio']")).toHaveLength(3);
    expect(root.textContent).not.toContain("Auto mode");
    expect(root.textContent).toContain("Uses Obsidian’s app authority outside the sandbox.");
    expect(root.textContent).toContain("delegated Obsidian app operations");
    expect(root.textContent).toContain("MCP servers and tools still need their separate switches");
    if (!toggle) throw new Error("Obsidian access toggle is missing.");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(onIntent).toHaveBeenCalledExactlyOnceWith({
      type: "permissions.set-obsidian-vault-access",
      payload: { expectedRevision: 31, expectedSessionId: "synthetic-session", expectedBindingRevision: 4, enabled: true },
    }));
    expect(model.accessPolicy).toEqual({ schemaVersion: 1, revision: 7, ...policy });
  });

  it.each(["default-on", "migrated-off", "explicit-off"] as const)("renders the runtime's Vault choice without deriving it locally: %s", (state) => {
    const model = permissionModel();
    const root = mount(createView(permissionModel({
      scope: { bindingRevision: 4, kind: "vault", selectedRootCount: 1, filesystemBound: true },
      obsidianVaultAccess: { status: "available", revision: 31, sessionId: "synthetic-session", bindingRevision: 4,
        enabled: state === "default-on", source: state === "explicit-off" ? "user" : "default",
        warning: "Uses Obsidian’s app authority outside the sandbox." },
      effective: { ...model.effective, obsidian: state === "default-on" ? "app-authority" : "unavailable" },
    })));
    expect(root.querySelector<HTMLInputElement>("input[aria-label='Allow Obsidian vault access']")?.checked).toBe(state === "default-on");
    expect(root.textContent).toContain(state === "explicit-off" ? "Your explicit choice" : "Runtime default");
  });

  it.each(["unavailable", "loading"] as const)("cannot change or imply a persisted Off choice while %s", (state) => {
    const root = mount(createView(permissionModel({
      loading: state === "loading",
      obsidianVaultAccess: { status: "unavailable", enabled: false, warning: "Uses Obsidian’s app authority outside the sandbox.", reason: "Authenticated target unavailable." },
    })));
    expect(root.querySelector<HTMLInputElement>("input[aria-label='Allow Obsidian vault access']")?.disabled).toBe(true);
    expect(root.textContent).toContain(state === "loading" ? "Loading" : "Authenticated target unavailable.");
    expect(root.textContent).not.toContain("Your explicit choice");
  });

  it("shows a rootless Project opt-in without changing its roots or claiming native containment", () => {
    const model = permissionModel();
    const root = mount(createView(permissionModel({
      scope: { kind: "project", bindingRevision: 4, selectedRootCount: 0, filesystemBound: false },
      nativeSupport: { status: "unverified" },
      obsidianVaultAccess: { status: "available", revision: 31, sessionId: "synthetic-session", bindingRevision: 4, enabled: true,
        source: "user", warning: "Uses Obsidian’s app authority outside the sandbox." },
      effective: { ...model.effective, fileRead: false, fileWrite: false, localProcess: "unavailable", obsidian: "app-authority" },
    })));
    expect(root.textContent).toContain("Project · 0 selected roots");
    expect(root.textContent).toContain("FilesUnavailable");
    expect(root.textContent).toContain("Local processesUnavailable");
    expect(root.textContent).toContain("Obsidian app authority outside the sandbox");
    expect(root.textContent).toContain("Not yet verified");
  });

  it.each(["session", "binding", "grant-revision", "loading", "unavailable"] as const)("rejects a stale rendered %s before sending any grant mutation", async (change) => {
    let model = permissionModel();
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const view = new PermissionsView({ getModel: () => model, getActiveSessionId: () => model.accessPolicySessionId, supportsObsidianVaultAccess: () => true, subscribe: () => () => {},
      onRefresh: async () => {}, onIntent, onBack: () => {} });
    const root = mount(view);
    const toggle = root.querySelector<HTMLInputElement>("input[aria-label='Allow Obsidian vault access']");
    model = permissionModel({
      loading: change === "loading",
      obsidianVaultAccess: change === "unavailable"
        ? { status: "unavailable", enabled: false, warning: "Uses Obsidian’s app authority outside the sandbox.", reason: "Target unavailable." }
        : { status: "available", revision: change === "grant-revision" ? 32 : 31, sessionId: change === "session" ? "different-session" : "synthetic-session",
          bindingRevision: change === "binding" ? 5 : 4, enabled: false, source: "default", warning: "Uses Obsidian’s app authority outside the sandbox." },
    });
    if (!toggle) throw new Error("Obsidian access toggle is missing.");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(root.textContent).toContain("active chat or its permissions changed"));
    expect(onIntent).not.toHaveBeenCalled();
  });
  it("shows a rootless Project without implying Vault fallback", () => {
    const root = mount(
      createView(
        permissionModel({
          scope: {
            bindingRevision: 4,
            kind: "project",
            selectedRootCount: 0,
            filesystemBound: false,
          },
          effective: {
            fileRead: false,
            fileWrite: false,
            localProcess: "unavailable",
            obsidian: "unavailable",
            agentNetworkAccess: false,
            warning: "This Project has no selected filesystem root.",
          },
        }),
      ),
    );

    expect(root.textContent).toContain("Active Project");
    expect(root.textContent).toContain("Project · 0 selected roots");
    expect(root.textContent).toContain("does not fall back to the whole Vault");
    expect(root.textContent).toContain("changes govern future actions");
    expect(root.textContent).toContain("do not remove existing conversation context");
    expect(root.textContent).toContain("FilesUnavailable");
    expect(root.textContent).toContain("ObsidianUnavailable");
  });

  it("sends one revision-bound Workspace policy change", async () => {
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const root = mount(createView(permissionModel(), onIntent));
    const workspace = root.querySelector<HTMLInputElement>(
      "input[aria-label='Workspace']",
    );
    if (!workspace) throw new Error("Workspace mode is missing");

    workspace.checked = true;
    workspace.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "permissions.set-access-policy",
        mainSessionId: "synthetic-session",
        payload: {
          expectedRevision: 7,
          accessMode: "workspace",
          agentNetworkAccess: false,
        },
      }),
    );
  });

  it("treats Full as unsandboxed and forces network on", async () => {
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const root = mount(createView(permissionModel(), onIntent));
    const full = root.querySelector<HTMLInputElement>(
      "input[aria-label='Full access']",
    );
    if (!full) throw new Error("Full access mode is missing");

    full.checked = true;
    full.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "permissions.set-access-policy",
        mainSessionId: "synthetic-session",
        payload: {
          expectedRevision: 7,
          accessMode: "full",
          agentNetworkAccess: true,
        },
      }),
    );

    const fullRoot = mount(
      createView(
        permissionModel({
          accessPolicy: {
            schemaVersion: 1,
            revision: 8,
            accessMode: "full",
            agentNetworkAccess: true,
          },
          effective: {
            fileRead: true,
            fileWrite: true,
            localProcess: "unsandboxed",
            obsidian: "unsandboxed",
            agentNetworkAccess: true,
            warning: "Full access uses ordinary user-account authority.",
          },
        }),
      ),
    );
    const network = fullRoot.querySelector<HTMLInputElement>(
      "input[aria-label='Allow agent network access']",
    );
    expect(network?.checked).toBe(true);
    expect(network?.disabled).toBe(true);
    expect(fullRoot.textContent).toContain("ordinary unsandboxed execution");
    expect(fullRoot.textContent).toContain("Unsandboxed as your user account");
  });

  it("keeps a rootless Project distinct from Vault while describing Full truthfully", () => {
    const root = mount(
      createView(
        permissionModel({
          accessPolicy: {
            schemaVersion: 1,
            revision: 8,
            accessMode: "full",
            agentNetworkAccess: true,
          },
          scope: {
            bindingRevision: 5,
            kind: "project",
            selectedRootCount: 0,
            filesystemBound: false,
          },
          effective: {
            fileRead: true,
            fileWrite: true,
            localProcess: "unsandboxed",
            obsidian: "unsandboxed",
            agentNetworkAccess: true,
            warning:
              "This Project has no selected filesystem root and never falls back to the Vault.",
          },
        }),
      ),
    );

    expect(root.textContent).toContain("does not fall back to the whole Vault");
    expect(root.textContent).toContain("explicit host paths");
    expect(root.textContent).not.toContain(
      "File and local-process access stays unavailable",
    );
  });

  it("changes agent network access independently in constrained modes", async () => {
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const root = mount(createView(permissionModel(), onIntent));
    const network = root.querySelector<HTMLInputElement>(
      "input[aria-label='Allow agent network access']",
    );
    if (!network) throw new Error("Agent network control is missing");

    network.checked = true;
    network.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() =>
      expect(onIntent).toHaveBeenCalledWith({
        type: "permissions.set-access-policy",
        mainSessionId: "synthetic-session",
        payload: {
          expectedRevision: 7,
          accessMode: "read-only",
          agentNetworkAccess: true,
        },
      }),
    );
    expect(root.textContent).toContain(
      "MCP servers and their selected tools remain a separate choice",
    );
  });

  it("uses nativeSupport as the sole readiness truth", () => {
    const root = mount(
      createView(
        permissionModel({
          accessPolicy: {
            schemaVersion: 1,
            revision: 7,
            accessMode: "workspace",
            agentNetworkAccess: false,
          },
          nativeSupport: {
            status: "setup-required",
            backendId: "windows-appcontainer",
            reason: "Native conformance is incomplete.",
            userAction: "Use brokered note operations or choose Full access.",
          },
          effective: {
            fileRead: true,
            fileWrite: true,
            localProcess: "unavailable",
            obsidian: "unavailable",
            agentNetworkAccess: false,
            warning: "Native process isolation is unavailable.",
          },
        }),
      ),
    );

    expect(root.textContent).toContain("Setup required");
    expect(root.textContent).toContain("Windows AppContainer");
    expect(root.textContent).toContain("Native conformance is incomplete");
    expect(root.textContent).toContain("Local processesUnavailable");
    expect(root.textContent).toContain("ObsidianUnavailable");
    expect(root.textContent).not.toContain("Typed workspace access");
    expect(root.textContent).not.toContain(
      "Contained by the ready native backend",
    );
  });

  it("does not infer constrained Vault access from a bound scope", () => {
    const root = mount(
      createView(
        permissionModel({
          accessPolicy: {
            schemaVersion: 1,
            revision: 7,
            accessMode: "workspace",
            agentNetworkAccess: false,
          },
          scope: {
            bindingRevision: 5,
            kind: "vault",
            selectedRootCount: 1,
            filesystemBound: true,
          },
          nativeSupport: {
            status: "unverified",
            backendId: "windows-appcontainer",
            reason: "Native conformance has not been proven on this device.",
          },
          effective: {
            fileRead: false,
            fileWrite: false,
            localProcess: "unavailable",
            obsidian: "unavailable",
            agentNetworkAccess: false,
            warning: "Constrained Vault access is unavailable until native support is ready.",
          },
        }),
      ),
    );

    expect(root.textContent).toContain("Vault");
    expect(root.textContent).toContain("Not yet verified");
    expect(root.textContent).toContain("FilesUnavailable");
    expect(root.textContent).toContain("ObsidianUnavailable");
    expect(root.textContent).not.toContain("Typed workspace access");
  });

  it("shows migration review without restoring retired profile controls", () => {
    const root = mount(
      createView(
        permissionModel({
          migrationNotice:
            "A former custom policy was narrowed to Read-only. Review it before widening access.",
        }),
      ),
    );

    expect(root.textContent).toContain("former custom policy was narrowed");
    expect(root.textContent).not.toContain("Permission profile");
    expect(root.textContent).not.toContain("AllowAskDeny");
    expect(root.textContent).not.toContain("Channel access");
  });

  it("preserves scroll while the runtime returns a new policy revision", async () => {
    let model = permissionModel();
    const listeners = new Set<
      (value: FrontendPermissionScreenViewModel | null) => void
    >();
    const view = new PermissionsView({
      getModel: () => model,
      getActiveSessionId: () => model.accessPolicySessionId,
      supportsObsidianVaultAccess: () => true,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      onRefresh: vi.fn(async () => {}),
      onIntent: vi.fn(async () => {
        model = {
          ...model,
          accessPolicy: { ...model.accessPolicy, revision: 8 },
          statusMessage: "Access policy updated.",
        };
        for (const listener of listeners) listener(model);
      }),
      onBack: vi.fn(),
    });
    const root = mount(view);
    const body = root.querySelector<HTMLElement>(
      ".chatobby-permissions__body",
    );
    if (!body) throw new Error("Permissions body is missing");
    body.scrollTop = 420;
    const workspace = root.querySelector<HTMLInputElement>(
      "input[aria-label='Workspace']",
    );
    if (!workspace) throw new Error("Workspace mode is missing");

    workspace.checked = true;
    workspace.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Access policy updated."),
    );
    expect(
      root.querySelector<HTMLElement>(".chatobby-permissions__body")?.scrollTop,
    ).toBe(420);
  });

  it.each(["session", "revision", "loading"] as const)("does not submit a stale mode/network control after %s changes", async (change) => {
    let model = permissionModel();
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const view = new PermissionsView({ getModel: () => model, getActiveSessionId: () => model.accessPolicySessionId, supportsObsidianVaultAccess: () => true,
      subscribe: () => () => {}, onRefresh: async () => {}, onIntent, onBack: () => {} });
    const root = mount(view);
    const oldMode = root.querySelector<HTMLInputElement>("input[aria-label='Workspace']")!;
    const oldNetwork = root.querySelector<HTMLInputElement>("input[aria-label='Allow agent network access']")!;
    model = permissionModel({ accessPolicySessionId: change === "session" ? "session-b" : "synthetic-session",
      loading: change === "loading", accessPolicy: { ...model.accessPolicy, revision: change === "revision" ? 8 : 7 } });
    oldMode.checked = true;
    oldMode.dispatchEvent(new Event("change"));
    oldNetwork.checked = true;
    oldNetwork.dispatchEvent(new Event("change"));
    expect(onIntent).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLInputElement>("input[aria-label='Read-only']")?.checked).toBe(true);
    view.destroy();
  });

  it("keeps independent panes' radio selections and network projections separate", () => {
    const a = createView(permissionModel({ accessPolicySessionId: "session-a" }));
    const b = createView(permissionModel({ accessPolicySessionId: "session-b",
      accessPolicy: { schemaVersion: 1, revision: 7, accessMode: "workspace", agentNetworkAccess: true } }));
    const aRoot = mount(a), bRoot = mount(b);
    document.body.append(aRoot, bRoot);
    const aMode = aRoot.querySelector<HTMLInputElement>("input[aria-label='Read-only']")!;
    const bMode = bRoot.querySelector<HTMLInputElement>("input[aria-label='Workspace']")!;
    expect(aMode.name).not.toBe(bMode.name);
    expect(aMode.checked).toBe(true);
    expect(bMode.checked).toBe(true);
    expect(aRoot.querySelector<HTMLInputElement>("input[aria-label='Allow agent network access']")?.checked).toBe(false);
    expect(bRoot.querySelector<HTMLInputElement>("input[aria-label='Allow agent network access']")?.checked).toBe(true);
    a.destroy(); b.destroy();
    aRoot.remove(); bRoot.remove();
  });

  it("does not display a previous session's late rejection on its replacement", async () => {
    let model = permissionModel();
    let reject!: (error: Error) => void;
    const onIntent = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    const view = new PermissionsView({ getModel: () => model, getActiveSessionId: () => model.accessPolicySessionId, supportsObsidianVaultAccess: () => true,
      subscribe: () => () => {}, onRefresh: async () => {}, onIntent, onBack: () => {} });
    const root = mount(view);
    const mode = root.querySelector<HTMLInputElement>("input[aria-label='Workspace']")!;
    mode.checked = true;
    mode.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(onIntent).toHaveBeenCalledOnce());
    model = permissionModel({ accessPolicySessionId: "session-b",
      accessPolicy: { schemaVersion: 1, revision: 7, accessMode: "full", agentNetworkAccess: true } });
    reject(new Error("Previous session failed."));
    await vi.waitFor(() => expect(root.querySelector<HTMLInputElement>("input[aria-label='Full access']")?.checked).toBe(true));
    expect(root.textContent).not.toContain("Previous session failed");
    expect(root.querySelector<HTMLInputElement>("input[aria-label='Allow agent network access']")?.disabled).toBe(true);
    view.destroy();
  });

  it("shows delegated-session mode and network as parent-controlled without enabling a child override", () => {
    const model = permissionModel({ accessPolicySessionId: "parent-session" });
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const view = new PermissionsView({ getModel: () => model, getActiveSessionId: () => "child-session",
      supportsObsidianVaultAccess: () => true, subscribe: () => () => {}, onRefresh: async () => {}, onIntent, onBack: () => {} });
    const root = mount(view);
    expect(root.textContent).toContain("Controlled by parent session. Mode and network are read-only here.");
    const modes = [...root.querySelectorAll<HTMLInputElement>("input[type='radio']")];
    expect(modes).toHaveLength(3);
    expect(modes.every((mode) => mode.disabled)).toBe(true);
    const network = root.querySelector<HTMLInputElement>("input[aria-label='Allow agent network access']")!;
    expect(network.disabled).toBe(true);
    modes[1]!.checked = true;
    modes[1]!.dispatchEvent(new Event("change"));
    network.checked = true;
    network.dispatchEvent(new Event("change"));
    expect(onIntent).not.toHaveBeenCalled();
    view.destroy();
  });

  it("uses the separate target-grant revision after session policy changes", async () => {
    let model = permissionModel();
    const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
    const view = new PermissionsView({ getModel: () => model, getActiveSessionId: () => model.accessPolicySessionId,
      supportsObsidianVaultAccess: () => true, subscribe: () => () => {}, onRefresh: async () => {}, onIntent, onBack: () => {} });
    const root = mount(view);
    const grant = root.querySelector<HTMLInputElement>("input[aria-label='Allow Obsidian vault access']")!;
    model = permissionModel({ accessPolicy: { ...model.accessPolicy, revision: 99, agentNetworkAccess: true } });
    grant.checked = true;
    grant.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(onIntent).toHaveBeenCalledExactlyOnceWith({ type: "permissions.set-obsidian-vault-access",
      payload: { expectedRevision: 31, expectedSessionId: "synthetic-session", expectedBindingRevision: 4, enabled: true } }));
    expect(model.accessPolicy.revision).toBe(99);
    view.destroy();
  });
});

function createView(
  model: FrontendPermissionScreenViewModel,
  onIntent: (intent: PermissionViewIntent) => Promise<void> = async () => {},
): PermissionsView {
  return new PermissionsView({
    getModel: () => model,
    getActiveSessionId: () => model.accessPolicySessionId,
    supportsObsidianVaultAccess: () => true,
    subscribe: () => () => {},
    onRefresh: vi.fn(async () => {}),
    onIntent,
    onBack: vi.fn(),
  });
}

function permissionModel(
  overrides: Partial<FrontendPermissionScreenViewModel> = {},
): FrontendPermissionScreenViewModel {
  return {
    screenId: "permissions",
    accessPolicySessionId: "synthetic-session",
    revision: 11,
    loading: false,
    accessPolicy: {
      schemaVersion: 1,
      revision: 7,
      accessMode: "read-only",
      agentNetworkAccess: false,
    },
    obsidianVaultAccess: {
      status: "available", revision: 31, sessionId: "synthetic-session", bindingRevision: 4,
      enabled: false, source: "default", warning: "Uses Obsidian’s app authority outside the sandbox.",
    },
    scope: {
      bindingRevision: 4,
      kind: "project",
      selectedRootCount: 1,
      filesystemBound: true,
    },
    nativeSupport: {
      status: "ready",
      backendId: "windows-appcontainer",
    },
    effective: {
      fileRead: true,
      fileWrite: false,
      localProcess: "unavailable",
      obsidian: "unavailable",
      agentNetworkAccess: false,
    },
    ...overrides,
  } as FrontendPermissionScreenViewModel;
}
