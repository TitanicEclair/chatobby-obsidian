import { describe, expect, it, vi } from "vitest";
import { ProjectsScreenController } from "../../src/features/projects/public";
import type { ProjectsViewIntent } from "../../src/features/projects/application/project-actions";
import { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";
import type { ChatobbyTransport } from "../../src/transport/ws-client";
import { parseFrontendIntent, type FrontendIntent, type FrontendIntentResult } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { projectBootstrap } from "../support/projects/screen";

/** Compose the actual controller and protocol: absolute paths belong only to registration;
 * the public wire parser receives opaque candidates, current identities and original revisions.
 * @see docs/architecture/frontend-modules.md#projects-contract-boundary
 * Runtime expiry/marker/CAS enforcement is tested by the source domain, not this transport stub.
 */
describe("Project action boundary", () => {
  const revision = { projectId: "project:viewed", expectedProjectRevision: 2 };
  const actions: readonly ProjectsViewIntent[] = [
    { type: "projects.set-view", payload: { query: "kept", lifecycleFilter: "active", availabilityFilter: "all", sort: "activity-desc", sessionQuery: "", sessionSearchMode: "titles", sessionSort: "updated-desc", sessionSearchPage: 0 } },
    { type: "projects.create", payload: { name: "New", vaultRelativePath: "Projects/New", markerPolicy: "required", directoryReuse: "none" } },
    { type: "projects.replace-details", payload: { ...revision, name: "Renamed", description: "Details" } },
    { type: "projects.archive", payload: revision }, { type: "projects.restore", payload: revision },
    { type: "projects.root-add", payload: { ...revision, label: "Attached", vaultRelativePath: "Docs", markerPolicy: "required", directoryReuse: "none" } },
    { type: "projects.root-relabel", payload: { ...revision, rootId: "root:one", label: "Renamed" } },
    { type: "projects.root-set-primary", payload: { ...revision, rootId: "root:two" } },
    { type: "projects.root-remove", payload: { ...revision, rootId: "root:one", replacementRootId: "root:two" } },
    { type: "projects.root-recover", payload: { projectId: "project:viewed", rootId: "root:one" } },
    { type: "projects.root-relink", payload: { ...revision, rootId: "root:one", vaultRelativePath: "New path" } },
    { type: "projects.session-move", payload: { sessionId: "session:running", expectedWorkspaceBindingRevision: 3, target: { kind: "vault" } } },
    { type: "session.create", payload: { workspace: { kind: "project", projectId: "project:viewed" } } },
    { type: "session.change-workspace", payload: { target: { kind: "project", projectId: "project:viewed", activeRootId: "root:one", sessionAttachedRootIds: [] } } },
    { type: "session.resume-by-id", payload: { sessionId: "session:other" } },
  ];

  it.each(actions)("passes $type through the public parser with the current leaf/session envelope", async action => {
    const f = fixture();
    try {
      await f.controller["dispatch"](action);
      expect(f.wire).toHaveLength(1);
      expect(f.wire[0]).toMatchObject({ ...action, schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime:one", viewId: "view:one", mainSessionId: "session:running" });
      expect(f.transport.registerProjectDirectoryCandidate).not.toHaveBeenCalled();
      expect(f.store.snapshot?.session).toBe(f.originalSession);
    } finally { f.dispose(); }
  });

  it.each(["create", "root-add", "root-relink"] as const)("registers %s once for its exact intent and strips the local path before mutation", async operation => {
    const f = fixture();
    const local = { systemAbsolutePath: "C:/External", directoryReuse: "none" as const, markerPolicy: "required" as const };
    const action: ProjectsViewIntent = operation === "create"
      ? { type: "projects.create", payload: { name: "External", ...local } }
      : operation === "root-add"
        ? { type: "projects.root-add", payload: { ...revision, label: "Untrusted picker label", ...local } }
        : { type: "projects.root-relink", payload: { ...revision, rootId: "root:one", systemAbsolutePath: local.systemAbsolutePath } };
    try {
      await f.controller["dispatch"](action);
      expect(f.order).toEqual(["register", "dispatch"]);
      expect(f.transport.registerProjectDirectoryCandidate).toHaveBeenCalledWith({ schemaVersion: 1, operation, intentId: f.wire[0]?.intentId, absolutePath: "C:/External" });
      expect(f.wire[0]?.payload).toMatchObject({ directoryCandidateRef: "candidate:1" });
      expect(f.raw[0]?.payload).not.toHaveProperty("systemAbsolutePath");
      if (operation === "root-add") expect(f.wire[0]?.payload).toMatchObject({ label: "Runtime label" });
    } finally { f.dispose(); }
  });

  it("waits for every batch registration and preserves root order, policy and revision in one mutation", async () => {
    const f = fixture();
    let release = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    f.transport.registerProjectDirectoryCandidate.mockImplementation(async request => {
      if (request.absolutePath === "C:/first") await held;
      return { schemaVersion: 1, directoryCandidateRef: request.absolutePath === "C:/first" ? "candidate:first" : "candidate:second", label: "Runtime label", locationKind: "external" };
    });
    try {
      const pending = f.controller["dispatch"]({ type: "projects.roots-add-batch", payload: { ...revision, roots: [
        { systemAbsolutePath: "C:/first", markerPolicy: "required", directoryReuse: "none" },
        { systemAbsolutePath: "D:/second", markerPolicy: "disabled", directoryReuse: "canonical" },
      ] } });
      expect(f.transport.registerProjectDirectoryCandidate).toHaveBeenCalledTimes(2);
      expect(f.wire).toHaveLength(0);
      release(); await pending;
      expect(f.wire[0]).toMatchObject({ type: "projects.roots-add-batch", payload: { ...revision, roots: [
        { directoryCandidateRef: "candidate:first", label: "Runtime label", markerPolicy: "required", directoryReuse: "none" },
        { directoryCandidateRef: "candidate:second", label: "Runtime label", markerPolicy: "disabled", directoryReuse: "canonical" },
      ] } });
      expect(f.transport.registerProjectDirectoryCandidate.mock.calls.every(([request]) => request.operation === "roots-add-batch" && request.intentId === f.wire[0]?.intentId)).toBe(true);
      expect(JSON.stringify(f.raw)).not.toContain("systemAbsolutePath");
    } finally { release(); f.dispose(); }
  });

  it("does not dispatch a mutation when candidate registration fails", async () => {
    const f = fixture();
    f.transport.registerProjectDirectoryCandidate.mockRejectedValue(new Error("Folder unavailable"));
    try {
      await expect(f.controller["dispatch"]({ type: "projects.root-relink", payload: { ...revision, rootId: "root:one", systemAbsolutePath: "C:/missing" } })).rejects.toThrow("Folder unavailable");
      expect(f.wire).toHaveLength(0);
    } finally { f.dispose(); }
  });

  it.each(["expired", "conflict"] as const)("surfaces %s without a retry, path fallback or discarded creation draft", async failure => {
    const f = fixture();
    f.controller["creationDraft"].updateDetails({ name: "Keep me", description: "And these details" });
    f.controller["creationDraft"].addRegisteredRoots([{ directoryCandidateRef: "candidate:old", label: "Existing", localPath: "C:/Existing" }]);
    const before = f.controller["creationDraft"].snapshot();
    f.transport.dispatchFrontendIntent.mockImplementation(async intent => failure === "expired"
      ? { ...intent, status: "rejected", errorCode: "PROJECT_DIRECTORY_CANDIDATE_EXPIRED", notice: { level: "error", message: "Selection expired" } }
      : { ...intent, status: "conflict", actualRevision: 8, notice: { level: "error", message: "Project changed" } });
    try {
      await expect(f.controller["submitCreationDraft"]()).rejects.toThrow(failure === "expired" ? "Selection expired" : "Project changed");
      expect(f.transport.dispatchFrontendIntent).toHaveBeenCalledOnce();
      expect(f.transport.registerProjectDirectoryCandidate).not.toHaveBeenCalled();
      expect(f.controller["creationDraft"].snapshot()).toEqual(before);
    } finally { f.dispose(); }
  });
});

function fixture() {
  const store = new FrontendStore(); store.replace(projectBootstrap());
  const originalSession = store.snapshot?.session;
  const wire: FrontendIntent[] = [], raw: FrontendIntent[] = [], order: string[] = [];
  const transport = {
    isConnected: true, onFrontendPatch: () => () => {}, onFrontendProtocolError: () => () => {},
    registerProjectDirectoryCandidate: vi.fn<ChatobbyTransport["registerProjectDirectoryCandidate"]>(async () => {
      order.push("register"); return { schemaVersion: 1, directoryCandidateRef: "candidate:1", label: "Runtime label", locationKind: "external" };
    }),
    dispatchFrontendIntent: vi.fn<ChatobbyTransport["dispatchFrontendIntent"]>(async intent => {
      order.push("dispatch"); raw.push(intent); wire.push(parseFrontendIntent(JSON.parse(JSON.stringify(intent))));
      return { ...intent, status: "accepted", acceptedAtSequence: 1 } satisfies FrontendIntentResult;
    }),
  } satisfies Pick<ChatobbyTransport, "isConnected" | "onFrontendPatch" | "onFrontendProtocolError" | "registerProjectDirectoryCandidate" | "dispatchFrontendIntent">;
  const protocol = new FrontendProtocolController({ store, createNegotiationRequest: () => { throw new Error("Already bootstrapped fixture"); }, onError: error => { throw error; } });
  // Only the exercised public transport methods are stubbed; controller/envelope/parser are real.
  protocol.bind(transport as unknown as ChatobbyTransport);
  const controller = new ProjectsScreenController({ app: {} as never, getHost: () => document.body, getStore: () => store, getProtocol: () => protocol,
    prepareOpen: vi.fn(), onOpened: vi.fn(), onClosed: vi.fn(), deleteSession: vi.fn(), runSessionAction: vi.fn(), navigateToMessageHit: vi.fn() });
  return { controller, protocol, transport, wire, raw, order, store, originalSession, dispose: () => { controller.destroy(); protocol.destroy(); } };
}
