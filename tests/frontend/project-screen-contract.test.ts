import { describe, expect, it } from "vitest";
import { FrontendStore } from "../../src/frontend/frontend-store";
import {
  frontendId,
  parseFrontendPatch,
  parseFrontendScreenResponse,
  type FrontendProjectScreenViewModel,
  type FrontendScreenResponse,
} from "../../src/vendor/chatobby-client/frontend-contracts.js";

import { projectBootstrap, projectScreen } from "../support/projects/screen";

/** Generated public parsing must reach the store, not just accept typed test fixtures.
 * Owner and limits: docs/architecture/frontend-modules.md#projects-contract-boundary.
 */
describe("generated Project screen boundary", () => {
  it("preserves viewed/running scope, roots, choices and optional navigator sessions across wire loads and patches", () => {
    const store = new FrontendStore();
    const initial = projectBootstrap();
    store.replace(initial);
    store.setDraft("project-create", "Keep this draft");
    const screen = projectScreen();

    store.replaceScreen(parseFrontendScreenResponse(wire(response(screen))));

    expect(store.snapshot?.screenModels).toEqual([screen]);
    expect(store.snapshot?.session).toBe(initial.session);
    expect(screen.selectedProjectId).not.toBe(screen.runningIn.projectId);
    expect(store.snapshot?.screenModels[0]).toMatchObject({
      detail: { roots: [{ directoryId: "directory:viewed", vaultRelativePath: "Projects/viewed" }] },
      runningRoots: [{ rootId: "root:running" }],
      navigatorSessions: [{ sessionId: "session:running", workspace: { projectId: "project:running" } }],
      sortOptions: [{ value: "activity-desc", description: "Most recently used", disabledReason: "Fixture choice" }],
    });

    const { navigatorSessions: _navigator, detail: _detail, selectedProjectId: _selected, ...withoutSelection } = screen;
    const updated = { ...withoutSelection, revision: 5, snapshotSequence: 1, query: "next" };
    const patch = parseFrontendPatch(wire({
      schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime:one", viewId: "view:one",
      scope: { kind: "view", viewId: "view:one" }, sequence: 1, baseRevision: 0, revision: 1,
      operations: [{ type: "screen.replace", screen: updated }],
    }));
    expect(store.apply(patch)).toBe("applied");
    expect(store.snapshot?.screenModels).toEqual([updated]);
    expect(store.snapshot?.screenModels[0]).not.toHaveProperty("navigatorSessions");
    expect(store.snapshot?.session).toBe(initial.session);
    expect(store.local.drafts.get("project-create")).toBe("Keep this draft");
  });

  it.each([
    ["root identity", (screen: FrontendProjectScreenViewModel) => ({
      ...screen, runningRoots: [{ ...screen.runningRoots[0], directoryId: undefined }],
    }), "directoryId"],
    ["shared choice", (screen: FrontendProjectScreenViewModel) => ({
      ...screen, sortOptions: [{ value: "activity-desc" }],
    }), "sortOptions[0].label"],
  ] as const)("rejects a malformed %s before any store mutation", (_name, malformed, message) => {
    const store = new FrontendStore();
    store.replace(projectBootstrap());
    store.replaceScreen(parseFrontendScreenResponse(wire(response(projectScreen()))));
    const accepted = store.snapshot;
    expect(() => store.replaceScreen(parseFrontendScreenResponse(wire({
      ...response(projectScreen()), requestEpoch: 2, screen: malformed(projectScreen()),
    })))).toThrow(message);
    expect(store.snapshot).toBe(accepted);
  });
});

function wire(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function response(screen: FrontendProjectScreenViewModel): FrontendScreenResponse {
  return {
    schemaVersion: 1, protocolVersion: 2,
    runtimeInstanceId: frontendId("runtime:one", "runtimeInstanceId"), viewId: frontendId("view:one", "viewId"),
    requestId: frontendId("screen:one", "requestId"), requestEpoch: 1, baseSequence: 0, screenRevision: screen.revision, screen,
  };
}
