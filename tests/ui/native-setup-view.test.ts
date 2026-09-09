import { describe, expect, it, vi } from "vitest";
import { PermissionsView, type PermissionViewIntent } from "../../src/ui/permissions/permissions-view";
import { nativeSetupIntentIsCurrent, type NativeSetupIntent } from "../../src/ui/permissions/native-setup-view";
import type { FrontendPermissionScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { mount } from "./helpers/mount";

type NativeView = NonNullable<FrontendPermissionScreenViewModel["nativeSetup"]>;
const fingerprint = "a".repeat(64);
const setupIntent: NativeSetupIntent = { type: "permissions.setup-native-sandbox", payload: {
  expectedSessionId: "session-a", expectedBindingRevision: 4, expectedPolicyRevision: 7,
  expectedGrantRevision: 2, targetFingerprint: fingerprint,
} };
const revokeIntent: NativeSetupIntent = { type: "permissions.revoke-native-sandbox", payload: {
  expectedSessionId: "session-a", expectedGrantRevision: 2, targetFingerprint: "b".repeat(64),
  grantId: "12345678-1234-1234-1234-123456789abc",
} };
const verifyIntent: NativeSetupIntent = { type: "permissions.verify-native-sandbox", payload: {
  expectedSessionId: "session-a", expectedVerificationRevision: 3, installationFingerprint: "d".repeat(64), action: "verify",
} };

function model(): FrontendPermissionScreenViewModel {
  return { screenId: "permissions", accessPolicySessionId: "session-a", revision: 11, loading: false,
    accessPolicy: { schemaVersion: 1, revision: 7, accessMode: "workspace", agentNetworkAccess: false },
    scope: { bindingRevision: 4, kind: "project", selectedRootCount: 1, filesystemBound: true },
    nativeSupport: { status: "unverified", backendId: "windows-appcontainer", reason: "Native proof remains incomplete." },
    effective: { fileRead: false, fileWrite: false, localProcess: "unavailable", obsidian: "unavailable", agentNetworkAccess: false },
    nativeSetup: { sessionId: "session-a", current: { status: "available", bindingRevision: 4, policyRevision: 7,
      accessMode: "workspace", networkAccess: false, roots: [{ stableId: "project:a", path: "C:/Synthetic/current" }],
      grant: { revision: 2, targetFingerprint: fingerprint, status: "setup-required" } },
      owned: { status: "available", revision: 2, grants: [{ grantId: revokeIntent.payload.grantId,
        targetFingerprint: "b".repeat(64), status: "recovery-required", accessMode: "read-only", networkAccess: true,
        bindingRevision: 2, policyRevision: 3, roots: [{ stableId: "project:old", path: "C:/Synthetic/recorded-old" }] }] } },
  };
}
function fixture(initial = model()) {
  let current = initial;
  let supported = true;
  const onIntent = vi.fn<(_intent: PermissionViewIntent) => Promise<void>>(async () => {});
  const view = new PermissionsView({ getModel: () => current, getActiveSessionId: () => "session-a", supportsObsidianVaultAccess: () => false,
    supportsNativeSetup: () => supported, subscribe: () => () => {}, onIntent, onRefresh: async () => {}, onBack: () => {} });
  const root = mount(view);
  return { view, root, onIntent, get: () => current,
    change: (value: FrontendPermissionScreenViewModel) => { current = value; },
    disconnect: () => { supported = false; } };
}
function click(root: HTMLElement, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll("button")].find((item) => item.textContent === text);
  if (!button) throw new Error(`Missing synthetic button: ${text}`);
  button.click();
  return button;
}
function currentTarget(value: FrontendPermissionScreenViewModel): Extract<NativeView["current"], { status: "available" }> {
  const current = value.nativeSetup?.current;
  if (current?.status !== "available") throw new Error("Synthetic current target unavailable");
  return current;
}
function verificationModel(): FrontendPermissionScreenViewModel {
  const value = model();
  return { ...value, nativeSetup: { ...value.nativeSetup!, verification: { status: "available", revision: 3,
    installationFingerprint: "d".repeat(64), busy: false, recoveryRequired: false, ready: false } } };
}

function landstripModel(ready = false): FrontendPermissionScreenViewModel {
  const value = verificationModel();
  return { ...value, nativeSupport: { status: "unverified", backendId: "landstrip" },
    nativeSetup: { ...value.nativeSetup!,
      current: { status: "not-required", roots: [{ stableId: "project:a", path: "C:/Synthetic/current" }] },
      verification: { status: "available", backendId: "landstrip", revision: 3,
        installationFingerprint: "d".repeat(64), busy: false, recoveryRequired: false, ready },
      owned: { status: "available", revision: 2, grants: [] },
    } };
}

describe("automatic workspace protection presentation", () => {
  it("shows no installation checklist, backend name or historical records when ready", () => {
    const value = landstripModel(true);
    const initial = { ...value, nativeSupport: { status: "ready" as const, backendId: "landstrip" },
      nativeSetup: { ...value.nativeSetup!, owned: model().nativeSetup!.owned } };
    const f = fixture(initial);
    for (const text of ["Device check", "Review verification", "Landstrip", "Folders and setup", "C:/Synthetic", "Retry"])
      expect(f.root.textContent).not.toContain(text);
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("shows a brief busy status and never launches checks from rendering", () => {
    const value = landstripModel();
    const check = value.nativeSetup!.verification;
    if (check?.status !== "available") throw new Error("Missing check");
    const f = fixture({ ...value, nativeSetup: { ...value.nativeSetup!, verification: { ...check, busy: true, historicalCleanupUnproved: true } } });
    expect(f.root.textContent).toContain("Preparing workspace protection");
    expect(f.root.textContent).not.toContain("Retry");
    expect(f.root.textContent).not.toContain("cleanup");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("offers one retry after failure with the exact current installation identity", async () => {
    const f = fixture(landstripModel());
    expect(f.root.textContent).toContain("Workspace protection could not start");
    expect(f.root.textContent).not.toContain("Review verification");
    click(f.root, "Retry");
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledExactlyOnceWith(verifyIntent));
  });
  it.each(["revision", "busy", "session", "disconnect"] as const)("rejects retry after %s changes", (change) => {
    const value = landstripModel();
    const check = value.nativeSetup!.verification;
    if (check?.status !== "available") throw new Error("Missing check");
    const f = fixture(value);
    if (change === "disconnect") f.disconnect();
    else f.change({ ...value, nativeSetup: { ...value.nativeSetup!,
      sessionId: change === "session" ? "other" : "session-a",
      verification: { ...check, revision: change === "revision" ? 4 : 3, busy: change === "busy" } } });
    click(f.root, "Retry");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("retains failure status when there is no current verification authority", () => {
    const value = landstripModel();
    const f = fixture({ ...value, nativeSetup: { ...value.nativeSetup!, verification: { status: "unavailable", backendId: "landstrip", reason: "Internal details" } } });
    expect(f.root.textContent).toContain("Restart Chatobby");
    expect(f.root.textContent).not.toContain("Internal details");
    expect(f.root.textContent).not.toContain("Retry");
  });
});

describe("explicit native setup and recorded-grant consent", () => {
  it("explains exact tuple reuse across chats and Vault-level recovery without granting support", () => {
    const f = fixture();
    expect(f.root.textContent).toContain("Folder grants apply to the exact folders");
    expect(f.root.textContent).toContain("Folder grants apply to the exact folders, mode and network choice below");
    expect(f.root.textContent).toContain("Saved folder grants");
    expect(f.root.textContent).not.toContain("Recorded grants for this chat");
    expect(f.root.textContent).toContain("Not yet verified");
    click(f.root, "Review setup");
    expect(f.root.textContent).toContain("folders, access mode and network choice shown above");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("labels an empty recovery inventory at Vault scope", () => {
    const initial = model();
    const native = initial.nativeSetup!;
    const f = fixture({ ...initial, nativeSetup: { ...native,
      owned: { status: "available", revision: 2, grants: [] } } });
    expect(f.root.textContent).not.toContain("Saved folder grants");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("requires review then explicit confirm, submitting only exact host-issued identity/CAS", async () => {
    const f = fixture();
    expect(f.onIntent).not.toHaveBeenCalled();
    click(f.root, "Review setup");
    expect(f.onIntent).not.toHaveBeenCalled();
    expect(f.root.textContent).toContain("C:/Synthetic/current");
    expect(f.root.textContent).toContain("Pauses workspace-restricted tools");
    click(f.root, "Confirm setup");
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledExactlyOnceWith(setupIntent));
    expect(f.onIntent.mock.calls[0]?.[0].payload).not.toHaveProperty("roots");
    expect(f.onIntent.mock.calls[0]?.[0].payload).not.toHaveProperty("profileSid");
    expect(f.get().accessPolicy.accessMode).toBe("workspace");
    expect(f.root.querySelectorAll("input[type=radio]")).toHaveLength(3);
    expect(f.root.textContent).toContain("MCP servers and tools still need their separate switches");
  });
  it("focuses cancel first and restores focus to the review button without an action", () => {
    const f = fixture();
    const review = click(f.root, "Review setup");
    expect(document.activeElement?.textContent).toBe("Cancel");
    expect(review.getAttribute("aria-expanded")).toBe("true");
    click(f.root, "Cancel");
    expect(document.activeElement).toBe(review);
    expect(review.getAttribute("aria-expanded")).toBe("false");
    expect(f.root.querySelector("[aria-label='Confirm native grant change']")).toBeNull();
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("can recover the recorded old roots when current roots are unresolved or Full", async () => {
    const initial = model();
    const native = initial.nativeSetup;
    if (!native) throw new Error("Missing synthetic view");
    const f = fixture({ ...initial, accessPolicy: { ...initial.accessPolicy, accessMode: "full", agentNetworkAccess: true },
      scope: { ...initial.scope, selectedRootCount: 0, filesystemBound: false },
      nativeSetup: { ...native, current: { status: "unavailable", reason: "Current Project was removed.", roots: [] } } });
    expect(f.root.textContent).toContain("C:/Synthetic/recorded-old");
    expect(f.root.textContent).not.toContain("C:/Synthetic/current");
    expect(f.root.textContent).toContain("Current Project was removed.");
    click(f.root, "Review revoke");
    expect(f.root.textContent).toContain("profile identity is retained");
    click(f.root, "Confirm revoke");
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledExactlyOnceWith(revokeIntent));
  });
  it.each(["session", "binding", "policy", "grant", "fingerprint", "network", "mode", "loading", "missing"] as const)(
    "rejects pending setup consent after %s changes", (change) => {
      const f = fixture();
      click(f.root, "Review setup");
      const before = f.get();
      const target = currentTarget(before);
      const native = before.nativeSetup!;
      f.change({ ...before, loading: change === "loading",
        accessPolicy: change === "mode" ? { ...before.accessPolicy, accessMode: "full", agentNetworkAccess: true }
          : change === "network" ? { ...before.accessPolicy, agentNetworkAccess: true } : before.accessPolicy,
        nativeSetup: change === "missing" ? undefined : { ...native, sessionId: change === "session" ? "session-b" : native.sessionId,
          current: { ...target, bindingRevision: change === "binding" ? 5 : 4, policyRevision: change === "policy" ? 8 : 7,
            grant: { ...target.grant, revision: change === "grant" ? 3 : 2,
              targetFingerprint: change === "fingerprint" ? "c".repeat(64) : fingerprint } } } });
      click(f.root, "Confirm setup");
      expect(f.onIntent).not.toHaveBeenCalled();
      expect(f.root.textContent).toContain("target or connection changed");
    });
  it("rejects stale recorded-grant consent after its journal revision changes", () => {
    const f = fixture();
    click(f.root, "Review revoke");
    const before = f.get();
    const native = before.nativeSetup!;
    if (native.owned.status !== "available") throw new Error("Missing synthetic owned view");
    f.change({ ...before, nativeSetup: { ...native, owned: { ...native.owned, revision: 3 } } });
    click(f.root, "Confirm revoke");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it.each(["disconnect", "destroy"] as const)("cannot dispatch a retained confirmation after %s", (change) => {
    const f = fixture();
    click(f.root, "Review setup");
    if (change === "disconnect") f.disconnect(); else f.view.destroy();
    click(f.root, "Confirm setup");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it.each(["provisioning", "revoking", "busy-reason"] as const)("shows busy and disables mutations for %s", (state) => {
    const initial = model();
    const target = currentTarget(initial);
    const f = fixture({ ...initial, nativeSetup: { ...initial.nativeSetup!, current: { ...target,
      grant: { ...target.grant, status: state === "busy-reason" ? "setup-required" : state,
        ...(state === "busy-reason" ? { reason: "native-setup-busy" } : {}) } } } });
    expect(f.root.textContent).toContain("Check in progress");
    click(f.root, "Review revoke");
    expect(f.root.querySelector("[aria-label='Confirm native grant change']")).toBeNull();
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("never upgrades configured grants into native-ready or dispatches setup automatically", () => {
    const initial = model();
    const target = currentTarget(initial);
    const f = fixture({ ...initial, nativeSetup: { ...initial.nativeSetup!, current: { ...target,
      grant: { ...target.grant, status: "configured" } } } });
    expect(f.root.textContent).toContain("configured");
    expect(f.root.textContent).toContain("Not yet verified");
    expect(f.root.textContent).not.toContain("Native isolation is ready");
    expect(f.root.textContent).not.toContain("Review setup");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("renders path text without interpreting markup", () => {
    const initial = model();
    const target = currentTarget(initial);
    const f = fixture({ ...initial, nativeSetup: { ...initial.nativeSetup!, current: { ...target,
      roots: [{ stableId: "test", path: "C:/Synthetic/<img src=x onerror=alert(1)>" }] } } });
    expect(f.root.querySelector("img")).toBeNull();
    expect(f.root.textContent).toContain("<img src=x");
  });
  it("reports a rejected host mutation without claiming configuration", async () => {
    const f = fixture();
    f.onIntent.mockRejectedValue(new Error("Native grant changed; inspect again."));
    click(f.root, "Review setup"); click(f.root, "Confirm setup");
    await vi.waitFor(() => expect(f.root.textContent).toContain("Native grant changed; inspect again."));
    expect(currentTarget(f.get()).grant.status).toBe("setup-required");
  });
  it("clears confirmation when an authoritative screen is rendered again", () => {
    const f = fixture();
    click(f.root, "Review setup");
    f.view.setLocalError(null);
    expect(f.root.querySelector("[aria-label='Confirm native grant change']")).toBeNull();
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it.each(["cancel", "refresh"] as const)("a detached confirmation cannot dispatch after %s", (action) => {
    const f = fixture();
    click(f.root, "Review setup");
    const confirm = [...f.root.querySelectorAll("button")].find((button) => button.textContent === "Confirm setup");
    if (action === "cancel") click(f.root, "Cancel"); else f.view.setLocalError(null);
    confirm?.click();
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("fails closed for absent/loading capability data but preserves old-root recovery separately", () => {
    const current = model();
    expect(nativeSetupIntentIsCurrent({ ...current, nativeSetup: undefined }, setupIntent)).toBe(false);
    expect(nativeSetupIntentIsCurrent({ ...current, loading: true }, revokeIntent)).toBe(false);
    expect(nativeSetupIntentIsCurrent(current, revokeIntent)).toBe(true);
  });
});

describe("explicit installed verification consent", () => {
  it("does not run on render or review and discloses the exact effects before confirming", async () => {
    const f = fixture(verificationModel());
    expect(f.onIntent).not.toHaveBeenCalled();
    click(f.root, "Review verification");
    expect(f.root.textContent).toContain("stops and drains active constrained work first");
    expect(f.root.textContent).toContain("1.1.1.1:443");
    expect(f.root.textContent).toContain("No application data is sent");
    expect(f.root.textContent).toContain("Your access choices and Project grants stay the same");
    expect(document.activeElement?.textContent).toBe("Cancel");
    expect(f.onIntent).not.toHaveBeenCalled();
    click(f.root, "Run check");
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledExactlyOnceWith(verifyIntent));
    expect(Object.keys(f.onIntent.mock.calls[0]![0].payload).sort()).toEqual([
      "action", "expectedSessionId", "expectedVerificationRevision", "installationFingerprint",
    ]);
    expect(f.root.textContent).toContain("Not yet verified");
    expect(f.root.textContent).toContain("Workspace restrictions help limit accidental changes; not intended to contain untrusted code.");
    expect(f.root.querySelectorAll("input[type=radio]")).toHaveLength(3);
  });
  it.each(["revision", "installation", "session", "recovery", "busy", "loading", "missing", "unavailable", "disconnect"] as const)(
    "rejects an old verification confirmation after %s changes", (change) => {
      const f = fixture(verificationModel());
      click(f.root, "Review verification");
      const before = f.get();
      const native = before.nativeSetup!;
      const verification = native.verification;
      if (verification?.status !== "available") throw new Error("Missing synthetic verification");
      if (change === "disconnect") f.disconnect();
      else f.change({ ...before, loading: change === "loading", nativeSetup: { ...native,
        sessionId: change === "session" ? "session-b" : native.sessionId,
        verification: change === "missing" ? undefined : change === "unavailable" ? { status: "unavailable", reason: "Unavailable" }
          : { ...verification, revision: change === "revision" ? 4 : verification.revision,
            installationFingerprint: change === "installation" ? "e".repeat(64) : verification.installationFingerprint,
            recoveryRequired: change === "recovery", busy: change === "busy" },
      } });
      click(f.root, "Run check");
      expect(f.onIntent).not.toHaveBeenCalled();
    });
  it("permits explicit verification while Full or current Project roots are unresolved", async () => {
    const before = verificationModel();
    const f = fixture({ ...before, accessPolicy: { ...before.accessPolicy, accessMode: "full", agentNetworkAccess: true },
      nativeSetup: { ...before.nativeSetup!, current: { status: "unavailable", reason: "Removed Project", roots: [] },
        owned: { status: "unavailable", reason: "No current grant owner" } } });
    click(f.root, "Review verification");
    click(f.root, "Run check");
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledExactlyOnceWith(verifyIntent));
  });
  it("offers only explicit recorded verification recovery, without certifying readiness", async () => {
    const before = verificationModel();
    const verification = before.nativeSetup!.verification;
    if (verification?.status !== "available") throw new Error("Missing synthetic verification");
    const f = fixture({ ...before, nativeSetup: { ...before.nativeSetup!, verification: { ...verification, recoveryRequired: true } } });
    expect(f.root.textContent).toContain("The previous check needs recovery before you can run another");
    expect(f.root.textContent).not.toContain("An older check has unresolved cleanup details");
    expect([...f.root.querySelectorAll("button")].some((button) => button.textContent === "Review verification")).toBe(false);
    click(f.root, "Review verification recovery");
    expect(f.root.textContent).toContain("previous check’s recorded grants");
    click(f.root, "Recover check");
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledExactlyOnceWith({ ...verifyIntent,
      payload: { ...verifyIntent.payload, action: "recover" } }));
    expect(f.root.textContent).toContain("Not yet verified");
  });
  it("shows installed proof separately from configured roots and does not infer session readiness", () => {
    const before = verificationModel();
    const verification = before.nativeSetup!.verification;
    if (verification?.status !== "available") throw new Error("Missing synthetic verification");
    const f = fixture({ ...before, nativeSetup: { ...before.nativeSetup!, verification: { ...verification, ready: true } } });
    expect(f.root.textContent).toContain("The installed protection checks passed");
    expect(f.root.textContent).toContain("Folder grants apply to the exact folders");
    expect(f.root.textContent).toContain("Not yet verified");
    expect(f.root.textContent).not.toContain("Workspace protection is ready");
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("disables all native mutations while verification is busy", () => {
    const before = verificationModel();
    const verification = before.nativeSetup!.verification;
    if (verification?.status !== "available") throw new Error("Missing synthetic verification");
    const f = fixture({ ...before, nativeSetup: { ...before.nativeSetup!, verification: { ...verification, busy: true } } });
    for (const label of ["Review setup", "Review revoke", "Review verification"]) expect(click(f.root, label).disabled).toBe(true);
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it.each(["cancel", "refresh", "destroy"] as const)("cannot use a retained verification button after %s", (action) => {
    const f = fixture(verificationModel());
    click(f.root, "Review verification");
    const confirm = [...f.root.querySelectorAll("button")].find((button) => button.textContent === "Run check");
    if (action === "cancel") click(f.root, "Cancel"); else if (action === "refresh") f.view.setLocalError(null); else f.view.destroy();
    confirm?.click();
    expect(f.onIntent).not.toHaveBeenCalled();
  });
  it("shows a failed verification without locally upgrading native status", async () => {
    const f = fixture(verificationModel());
    f.onIntent.mockRejectedValue(new Error("Installed capability observation failed."));
    click(f.root, "Review verification"); click(f.root, "Run check");
    await vi.waitFor(() => expect(f.root.textContent).toContain("Installed capability observation failed."));
    expect(f.root.textContent).toContain("Not yet verified");
  });
  it("does not expose Verify for missing or unavailable host inspection", () => {
    const before = model();
    const missing = fixture(before);
    expect(missing.root.textContent).toContain("Device checks are unavailable");
    expect(missing.root.textContent).not.toContain("Review verification");
    const f = fixture({ ...before, nativeSetup: { ...before.nativeSetup!, verification: { status: "unavailable", reason: "Installed helper is missing." } } });
    expect(f.root.textContent).toContain("Installed helper is missing");
    expect(f.root.textContent).not.toContain("Review verification");
  });
});
