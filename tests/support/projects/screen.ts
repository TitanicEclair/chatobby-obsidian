import { frontendId, type FrontendBootstrap, type FrontendProjectRootViewModel, type FrontendProjectScreenViewModel } from "../../../src/vendor/chatobby-client/frontend-contracts.js";

/** Current public fixtures; viewed and running Projects deliberately differ. */
function root(name: string): FrontendProjectRootViewModel {
  return {
    rootId: `root:${name}`, directoryId: `directory:${name}`, label: name, primary: true,
    locationKind: "vault-relative", vaultRelativePath: `Projects/${name}`, directoryReuse: "canonical",
    markerPolicy: "required", recoveryMode: "marker", availability: "available", availabilityLabel: "Ready",
  };
}

export function projectScreen(): FrontendProjectScreenViewModel {
  return {
    screenId: "projects", revision: 4, snapshotSequence: 0, loading: false,
    query: "", lifecycleFilter: "active", availabilityFilter: "all", sort: "activity-desc",
    sessionQuery: "", sessionSearchMode: "titles", sessionSort: "updated-desc", sessionSearchPage: 0,
    selectedProjectId: "project:viewed",
    runningIn: { kind: "project", label: "Running", projectId: "project:running", activeRootId: "root:running", attachedRootIds: [] },
    projects: [{
      projectId: "project:viewed", revision: 2, name: "Viewed", lifecycle: "active", creationKind: "manual",
      primaryRootId: "root:viewed", rootCount: 1, sessionCount: 0, availability: "available", availabilityLabel: "Ready",
      createdAt: "2026-10-01", updatedAt: "2026-10-02", activityAt: "2026-10-02",
    }],
    sessionMoveProjects: [{ projectId: "project:viewed", name: "Viewed", available: true, availabilityLabel: "Ready" }],
    vaultSessionCount: 0, vaultSessions: [],
    navigatorSessions: [{
      sessionId: "session:running", workspaceBindingRevision: 3, workspace: { kind: "project", projectId: "project:running" },
      name: "Running", messageCount: 8, running: true, active: false,
    }],
    detail: {
      projectId: "project:viewed", revision: 2, name: "Viewed", lifecycle: "active", creationKind: "manual",
      primaryRootId: "root:viewed", roots: [root("viewed")], sessionCount: 0, sessions: [],
    },
    runningRoots: [root("running")],
    lifecycleOptions: [{ value: "active", label: "Active" }],
    availabilityOptions: [{ value: "all", label: "All" }],
    sortOptions: [{ value: "activity-desc", label: "Recent", description: "Most recently used", disabledReason: "Fixture choice" }],
    sessionSearchModeOptions: [{ value: "titles", label: "Titles" }],
    sessionSortOptions: [{ value: "updated-desc", label: "Last used" }],
  };
}

export function projectBootstrap(): FrontendBootstrap {
  return {
    schemaVersion: 1, protocolVersion: 2, revision: 0, sequence: 0,
    runtimeInstanceId: frontendId("runtime:one", "runtimeInstanceId"), viewId: frontendId("view:one", "viewId"),
    session: {
      id: "session:running", workingDirectory: "C:/fixture/Projects/running", model: "fixture/model", thinkingLevel: "off",
      streaming: false, compacting: false, retrying: false, messageCount: 8, forkOptions: [],
      workspace: { kind: "project", projectId: "project:running", label: "Running" },
    },
    taskPlan: { revision: 0, completedCount: 0, remainingCount: 0, summary: "No tracked tasks", items: [] },
    composer: { controls: [], canSubmit: true }, agentRail: { items: [] }, feed: { revision: 0, blocks: [] },
    screens: [], screenModels: [], localCommands: [],
  };
}
