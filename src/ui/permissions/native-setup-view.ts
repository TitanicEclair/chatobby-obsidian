import type { FrontendIntent, FrontendPermissionScreenViewModel } from "../../vendor/chatobby-client/frontend-contracts.js";
import { createPageSection } from "../shared/page-shell";

type SetupView = NonNullable<FrontendPermissionScreenViewModel["nativeSetup"]>;
export type NativeSetupIntent =
  | Pick<Extract<FrontendIntent, { type: "permissions.setup-native-sandbox" }>, "type" | "payload">
  | Pick<Extract<FrontendIntent, { type: "permissions.revoke-native-sandbox" }>, "type" | "payload">
  | Pick<Extract<FrontendIntent, { type: "permissions.verify-native-sandbox" }>, "type" | "payload">;

/** Presentation/consent only. The host owns targets, the journal, native effects and readiness. */
export function renderNativeSetup(
  parent: HTMLElement,
  model: FrontendPermissionScreenViewModel,
  supported: boolean,
  saving: boolean,
  submit: (intent: NativeSetupIntent) => void,
): void {
  if (model.nativeSupport.backendId === "landstrip" || model.nativeSetup?.verification?.backendId === "landstrip") {
    renderAutomaticProtection(parent, model, supported, saving, submit);
    return;
  }
  const section = createPageSection(parent, {
    title: "Device check",
    description: "Check that workspace protection works on this installation.",
    surface: "divided", className: "chatobby-permissions__section",
  });
  const body = section.content;
  const view = model.nativeSetup;
  if (!supported || !view || model.loading) {
    body.createDiv({ cls: "chatobby-permissions__support-detail", text: model.loading
      ? "Loading device status…" : "Device checks are unavailable on this runtime connection." });
    return;
  }
  const busy = nativeSetupBusy(view);
  const perLaunch = view.current.status === "not-required";
  if (saving || busy) body.createDiv({ cls: "chatobby-permissions__notice", attr: { role: "status" },
    text: "Check in progress. Workspace-restricted tools are temporarily paused." });
  renderVerification(body, view, saving || busy, submit);

  const details = disclosure(body, "Folders and setup details");
  details.createEl("p", { text: perLaunch
    ? "Protection uses your selected folders, access mode and network choice on each launch. No separate folder setup is needed."
    : "Folder grants apply to the exact folders, mode and network choice below." });
  details.createEl("h3", { text: "Selected folders" });
  const current = view.current;
  renderRoots(details, current.roots);
  if (current.status === "unavailable") {
    details.createDiv({ cls: "chatobby-permissions__support-detail", text: current.reason });
  } else if (current.status === "available") {
    renderGrantSummary(details, current.accessMode, current.networkAccess, current.grant.status);
    if (current.grant.reason) details.createDiv({ cls: "chatobby-permissions__support-detail", text: current.grant.reason });
    if (current.grant.status === "setup-required" || current.grant.status === "revoked") {
      // Required setup stays visible; optional diagnostics remain folded.
      details.open = true;
      renderConsent(details, "setup", saving || busy || current.roots.length === 0, () => submit({
        type: "permissions.setup-native-sandbox",
        payload: { expectedSessionId: view.sessionId, expectedBindingRevision: current.bindingRevision,
          expectedPolicyRevision: current.policyRevision, expectedGrantRevision: current.grant.revision,
          targetFingerprint: current.grant.targetFingerprint },
      }));
    }
  }
  if (view.owned.status !== "available" || view.owned.grants.length === 0) return;
  const recorded = disclosure(body, "Saved folder grants");
  for (const grant of view.owned.grants) {
    const card = recorded.createDiv({ cls: "chatobby-permissions__grant" });
    renderRoots(card, grant.roots);
    renderGrantSummary(card, grant.accessMode, grant.networkAccess, grant.status);
    card.createDiv({ cls: "chatobby-permissions__scope-detail",
      text: `Binding ${grant.bindingRevision} · policy ${grant.policyRevision}. These folders may differ from the current workspace.` });
    if (grant.status === "configured" || grant.status === "recovery-required") {
      if (grant.status === "recovery-required") recorded.open = true;
      const revision = view.owned.revision;
      renderConsent(card, "revoke", saving || busy, () => submit({ type: "permissions.revoke-native-sandbox",
        payload: { expectedSessionId: view.sessionId, expectedGrantRevision: revision,
          grantId: grant.grantId, targetFingerprint: grant.targetFingerprint },
      }));
    }
  }
}

function renderAutomaticProtection(parent: HTMLElement, model: FrontendPermissionScreenViewModel, supported: boolean,
  saving: boolean, submit: (intent: NativeSetupIntent) => void): void {
  if (model.nativeSupport.status === "ready") return;
  const view = model.nativeSetup;
  const check = view?.verification;
  const busy = model.loading || (check?.status === "available" && check.busy);
  const canRetry = supported && view && check?.status === "available" && !check.recoveryRequired;
  const section = createPageSection(parent, { title: "Workspace protection", surface: "divided", className: "chatobby-permissions__section" });
  section.content.createDiv({ attr: { role: "status" }, text: busy ? "Preparing workspace protection…"
    : canRetry ? "Workspace protection could not start. Retry, or restart Chatobby from Settings."
      : "Workspace protection could not start. Restart Chatobby from Settings." });
  if (!busy && canRetry) {
    const retry = section.content.createEl("button", { text: "Retry", attr: { type: "button" } });
    retry.disabled = saving;
    retry.addEventListener("click", () => {
      if (!retry.isConnected || retry.disabled) return;
      submit({ type: "permissions.verify-native-sandbox", payload: { expectedSessionId: view.sessionId,
        expectedVerificationRevision: check.revision, installationFingerprint: check.installationFingerprint, action: "verify" } });
    });
  }
}

function disclosure(parent: HTMLElement, title: string): HTMLDetailsElement {
  const details = parent.createEl("details", { cls: "chatobby-permissions__details" });
  details.createEl("summary", { text: title });
  return details;
}

/** Reject stale DOM consent locally; host CAS/owner checks remain the authorization boundary. */
export function nativeSetupIntentIsCurrent(model: FrontendPermissionScreenViewModel | null, intent: NativeSetupIntent): boolean {
  const view = model?.nativeSetup;
  if (!model || model.loading || !view || view.sessionId !== intent.payload.expectedSessionId || nativeSetupBusy(view)) return false;
  if (intent.type === "permissions.verify-native-sandbox") {
    const verification = view.verification;
    return verification?.status === "available"
      && verification.revision === intent.payload.expectedVerificationRevision
      && verification.installationFingerprint === intent.payload.installationFingerprint
      && (verification.recoveryRequired ? "recover" : "verify") === intent.payload.action;
  }
  if (intent.type === "permissions.setup-native-sandbox") {
    const target = view.current;
    return target.status === "available" && target.roots.length > 0
      && (target.grant.status === "setup-required" || target.grant.status === "revoked")
      && target.bindingRevision === intent.payload.expectedBindingRevision
      && target.policyRevision === intent.payload.expectedPolicyRevision
      && model.accessPolicy.revision === target.policyRevision
      && model.accessPolicy.accessMode === target.accessMode
      && model.accessPolicy.agentNetworkAccess === target.networkAccess
      && model.scope.bindingRevision === target.bindingRevision
      && target.grant.revision === intent.payload.expectedGrantRevision
      && target.grant.targetFingerprint === intent.payload.targetFingerprint;
  }
  return view.owned.status === "available" && view.owned.revision === intent.payload.expectedGrantRevision
    && view.owned.grants.some((grant) => grant.grantId === intent.payload.grantId
      && grant.targetFingerprint === intent.payload.targetFingerprint
      && (grant.status === "configured" || grant.status === "recovery-required"));
}

function nativeSetupBusy(view: SetupView): boolean {
  return (view.verification?.status === "available" && view.verification.busy)
    || (view.current.status === "available" && (view.current.grant.reason === "native-setup-busy"
    || view.current.grant.status === "provisioning" || view.current.grant.status === "revoking"))
    || (view.owned.status === "available" && view.owned.grants.some((grant) => grant.status === "provisioning" || grant.status === "revoking"));
}

function renderVerification(parent: HTMLElement, view: SetupView, disabled: boolean, submit: (intent: NativeSetupIntent) => void): void {
  const verification = view.verification;
  if (!verification || verification.status === "unavailable") {
    parent.createDiv({ cls: "chatobby-permissions__support-detail", text: verification?.reason
      ?? "Device checks are unavailable on this runtime connection." });
    return;
  }
  parent.createDiv({ cls: "chatobby-permissions__support-detail", text: verification.recoveryRequired
    ? "The previous check needs recovery before you can run another."
    : verification.ready ? "The installed protection checks passed."
      : "This installation has not passed its protection checks yet." });
  if (verification.historicalCleanupUnproved === true) {
    parent.createDiv({ cls: "chatobby-permissions__notice", attr: { role: "status" }, text: "An older check has unresolved cleanup details." });
    const history = disclosure(parent, "About the previous check");
    history.createEl("p", { text: "Its evidence is retained. Cleanup of its processes, file permissions and profiles has not been proved. A new successful check does not repair or certify that older cleanup." });
  }
  if (verification.reason) disclosure(parent, "Check details").createEl("p", { text: verification.reason });
  const action = verification.recoveryRequired ? "recover" : "verify";
  renderConsent(parent, action, disabled, () => submit({ type: "permissions.verify-native-sandbox", payload: {
    expectedSessionId: view.sessionId, expectedVerificationRevision: verification.revision,
    installationFingerprint: verification.installationFingerprint, action,
  } }), verification.backendId === "landstrip", verification.historicalCleanupUnproved === true);
}

function renderRoots(parent: HTMLElement, roots: SetupView["current"]["roots"]): void {
  const list = parent.createEl("ul", { cls: "chatobby-permissions__root-list", attr: { "aria-label": "Affected roots" } });
  for (const root of roots) list.createEl("li", { text: root.path });
  if (roots.length === 0) list.createEl("li", { text: "No resolved roots. No Vault fallback." });
}

function renderGrantSummary(parent: HTMLElement, mode: "read-only" | "workspace", network: boolean, status: string): void {
  parent.createDiv({ cls: "chatobby-permissions__scope-detail",
    text: `${mode === "read-only" ? "Read-only" : "Workspace"} · agent network ${network ? "On" : "Off"} · ${status.replaceAll("-", " ")}` });
}

function renderConsent(parent: HTMLElement, action: "setup" | "revoke" | "verify" | "recover", disabled: boolean, confirm: () => void, landstrip = false, historicalCleanupUnproved = false): void {
  const row = parent.createDiv({ cls: "chatobby-permissions__grant-actions" });
  const label = action === "verify" ? "verification" : action === "recover" ? "verification recovery" : action;
  const review = row.createEl("button", { text: `Review ${label}`, attr: { type: "button", "aria-expanded": "false" } });
  review.disabled = disabled;
  review.addEventListener("click", () => {
    if (!review.isConnected || disabled || review.getAttribute("aria-expanded") === "true") return;
    review.setAttribute("aria-expanded", "true");
    const panel = row.createDiv({ cls: "chatobby-permissions__consent", attr: { role: "group", "aria-label": action === "verify" || action === "recover"
      ? "Confirm installed verification" : "Confirm native grant change" } });
    panel.createDiv({ cls: "chatobby-permissions__consent-title", text: action === "verify" ? "Run a device check?"
      : action === "recover" ? "Recover the previous check?" : action === "setup" ? "Set up these folders?" : "Remove these folder grants?" });
    const steps = panel.createEl("ul");
    const items = action === "verify" ? [
      "Temporarily pauses workspace-restricted tools.",
      "Tests protection with new sample files and a brief network check. No application data is sent.",
      "Keeps test evidence. Your access choices and Project grants stay the same.",
    ] : action === "recover" ? [
      landstrip ? "Closes the retained attempt only when its recorded process cleanup is complete." : "Pauses restricted tools and recovers the previous check’s recorded grants.",
      "Keeps evidence and profile identities. Recovery alone does not verify protection.",
    ] : action === "setup" ? [
      "Uses exactly the folders, access mode and network choice shown above.",
      "Pauses workspace-restricted tools while setup completes.",
    ] : [
      "Removes only these recorded grants and preserves other file permissions.",
      "Pauses workspace-restricted tools during recovery; the profile identity is retained.",
    ];
    for (const item of items) steps.createEl("li", { text: item });
    if (action === "verify" || action === "recover") {
      const technical = disclosure(panel, "Technical details");
      technical.createEl("p", { text: action === "verify"
        ? "The check uses synthetic files and profiles, including TCP connection tests to 1.1.1.1:443. It stops and drains active constrained work first; ordinary host processes and Full access work are not stopped."
        : landstrip ? "This does not repair or revoke file permissions or profiles, run fresh tests, or certify readiness."
          : "The runtime must prove owned cleanup before proceeding. Project grants are not changed." });
      if (action === "verify" && historicalCleanupUnproved) technical.createEl("p", { text: "Previous cleanup remains unproved even if this new check passes. The earlier evidence is preserved without repairing its processes, file permissions or profiles." });
    }
    const controls = panel.createDiv({ cls: "chatobby-permissions__consent-actions" });
    const cancel = controls.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => { panel.remove(); review.setAttribute("aria-expanded", "false"); review.focus(); });
    const accept = controls.createEl("button", { cls: "mod-cta", text: action === "verify" ? "Run check" : action === "recover" ? "Recover check" : `Confirm ${label}`, attr: { type: "button" } });
    accept.addEventListener("click", () => { if (!accept.isConnected) return; accept.disabled = true; confirm(); });
    cancel.focus();
  });
}
