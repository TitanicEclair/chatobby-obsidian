import { describe, expect, it, vi } from "vitest";
import { DirectoryProjectLaunch, type DirectoryProjectLaunchOptions } from "../../src/features/projects/public";
import { frontendId, type FrontendSubscriptionResult } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { projectBootstrap, projectScreen } from "../support/projects/screen";

/** Preserve file-explorer launch/cancellation and runtime query ordering.
 * @see docs/architecture/frontend-modules.md#projects-contract-boundary
 * Native modal focus and installed session lifecycles remain separate acceptance.
 */
describe("directory Project launch", () => {
  it("uses the active canonical identity after negotiation and subscription, then remembers reuse before opening", async () => {
    const f = fixture();
    f.options.requestDecision.mockResolvedValue({ action: "reuse-canonical", remember: true });
    await f.launch.start("/Projects\\viewed/");
    expect(f.order).toEqual(["runtime", "utility", "negotiate", "subscribe", "screen", "remember", "open"]);
    expect(f.transport.subscribeFrontend.mock.calls[0]?.[0]).toMatchObject({ runtimeInstanceId: "runtime:one", viewId: "chatobby-project-directory-probe" });
    expect(f.transport.getFrontendScreen.mock.calls[0]?.[0]).toMatchObject({ baseSequence: 7, requestEpoch: 1, screenId: "projects" });
    expect(f.options.requestDecision).toHaveBeenCalledWith({ projectName: "Viewed", vaultRelativePath: "/Projects\\viewed/" });
    expect(f.view.createSessionForProject).toHaveBeenCalledWith("project:viewed");
    expect(f.view.createProjectForCurrentSession).not.toHaveBeenCalled();
  });

  it.each(["Projects/Other", ""])("creates only an absent canonical Project for %s using the existing default name", async path => {
    const f = fixture();
    await f.launch.start(path);
    expect(f.view.createProjectForCurrentSession).toHaveBeenCalledWith({ name: path ? "Other" : "New Project", vaultRelativePath: path });
    expect(f.options.requestDraft).not.toHaveBeenCalled();
    expect(f.options.requestDecision).not.toHaveBeenCalled();
  });

  it("ignores an archived canonical match and preserves create-new draft details", async () => {
    const f = fixture();
    f.screen.projects = f.screen.projects.map(project => ({ ...project, lifecycle: "archived" }));
    await f.launch.start("Projects/viewed");
    expect(f.view.createProjectForCurrentSession).toHaveBeenLastCalledWith({ name: "viewed", vaultRelativePath: "Projects/viewed" });
    f.screen.projects = f.screen.projects.map(project => ({ ...project, lifecycle: "active" }));
    f.options.getLaunchBehavior.mockReturnValue("create-new");
    await f.launch.start("Projects/viewed");
    expect(f.view.createProjectForCurrentSession).toHaveBeenLastCalledWith({ name: "Separate", description: "Purpose", vaultRelativePath: "Projects/viewed" });
    expect(f.options.requestDecision).not.toHaveBeenCalled();
  });

  it.each(["decision", "draft"] as const)("cancels %s before opening a chat or saving a preference", async phase => {
    const f = fixture();
    if (phase === "decision") f.options.requestDecision.mockResolvedValue(null);
    else { f.options.getLaunchBehavior.mockReturnValue("create-new"); f.options.requestDraft.mockResolvedValue(null); }
    await f.launch.start("Projects/viewed");
    expect(f.options.openBlankView).not.toHaveBeenCalled();
    expect(f.options.rememberLaunchBehavior).not.toHaveBeenCalled();
  });

  it("creates explicitly without a probe and cancels a dismissed draft without opening", async () => {
    const f = fixture();
    await f.launch.create("Projects/viewed");
    expect(f.transport.getFrontendScreen).not.toHaveBeenCalled();
    expect(f.options.openBlankView).toHaveBeenCalledOnce();
    f.options.requestDraft.mockResolvedValue(null);
    await f.launch.create("Projects/viewed");
    expect(f.options.openBlankView).toHaveBeenCalledOnce();
  });

  it("browses the canonical Project in a fresh view without creating or rebinding a session", async () => {
    const f = fixture();
    await f.launch.browse("Projects/viewed");
    expect(f.view.openProjectSessions).toHaveBeenCalledWith("project:viewed");
    expect(f.view.createSessionForProject).not.toHaveBeenCalled();
    expect(f.view.createProjectForCurrentSession).not.toHaveBeenCalled();
  });

  it.each([true, false])("reveals the overview on the existing/fallback chat without inventing a Project (active=%s)", async active => {
    const f = fixture();
    f.options.getActiveView.mockReturnValue(active ? f.view : null);
    await f.launch.browse("No canonical match");
    expect(f.options.openBlankView).toHaveBeenCalledTimes(active ? 0 : 1);
    if (!active) expect(f.options.openBlankView).toHaveBeenCalledWith();
    expect(f.options.revealView).toHaveBeenCalledWith(f.view);
    expect(f.view.commandOpenPage).toHaveBeenCalledWith("projects");
  });

  it.each(["disconnected", "resync", "screen"] as const)("does not launch after %s failure", async failure => {
    const f = fixture();
    if (failure === "disconnected") f.connection.connected = false;
    if (failure === "resync") f.transport.subscribeFrontend.mockImplementation(async request => ({
      ...request, status: "resync-required", sequence: 7, revision: 0, oldestReplayableSequence: 0,
      error: { schemaVersion: 1, protocolVersion: 2, code: "sequence-gap", message: "Refresh required", retryable: true, resync: "full-bootstrap" },
    }));
    if (failure === "screen") f.transport.getFrontendScreen.mockRejectedValue(new Error("Screen unavailable"));
    await expect(f.launch.start("Projects/viewed")).rejects.toThrow();
    expect(f.options.openBlankView).not.toHaveBeenCalled();
    expect(f.options.rememberLaunchBehavior).not.toHaveBeenCalled();
  });
});

function fixture() {
  const order: string[] = [];
  const connection = { connected: true };
  const view = {
    createProjectForCurrentSession: vi.fn(async () => {}), createSessionForProject: vi.fn(async () => {}),
    openProjectSessions: vi.fn(async () => {}), commandOpenPage: vi.fn(),
  };
  type Options = DirectoryProjectLaunchOptions<typeof view>;
  type Transport = Awaited<ReturnType<Options["ensureUtilityTransport"]>>;
  const screen = { ...projectScreen(), projects: projectScreen().projects.map(project => ({ ...project, canonicalVaultRelativePath: "Projects/viewed" })) };
  const transport = {
    get isConnected() { return connection.connected; },
    negotiateFrontend: vi.fn<Transport["negotiateFrontend"]>(async request => {
      order.push("negotiate");
      return { schemaVersion: 1, protocolVersion: 2, requestId: request.requestId, viewId: request.viewId,
        runtimeInstanceId: frontendId("runtime:one", "runtimeInstanceId"), selectedCapabilities: [], unavailableCapabilities: [], replayLimit: 10 };
    }),
    subscribeFrontend: vi.fn<Transport["subscribeFrontend"]>(async request => {
      order.push("subscribe");
      return { ...request, status: "bootstrapped", sequence: 7, revision: 0, oldestReplayableSequence: 0,
        bootstrap: { ...projectBootstrap(), viewId: request.viewId, sequence: 7 }, replay: [] } satisfies FrontendSubscriptionResult;
    }),
    getFrontendScreen: vi.fn<Transport["getFrontendScreen"]>(async request => {
      order.push("screen"); return { ...request, screenRevision: screen.revision, screen };
    }),
  } satisfies Transport;
  const options = {
    ensureRuntime: vi.fn(async () => { order.push("runtime"); }),
    ensureUtilityTransport: vi.fn(async () => { order.push("utility"); return transport; }),
    negotiationRequest: (viewId: string) => ({ schemaVersion: 1 as const, requestId: frontendId("negotiate:one", "requestId"),
      viewId: frontendId(viewId, "viewId"), connectorVersion: "0.5.3", obsidianVersion: "1.13.1",
      vaultInstanceId: frontendId("vault:one", "vaultInstanceId"), supportedProtocolVersions: [2],
      capabilities: { featureFamilies: [], protocolCapabilities: [], integrations: [] } }),
    getLaunchBehavior: vi.fn<Options["getLaunchBehavior"]>(() => "ask"),
    rememberLaunchBehavior: vi.fn<Options["rememberLaunchBehavior"]>(async () => { order.push("remember"); }),
    requestDecision: vi.fn<Options["requestDecision"]>(async () => ({ action: "reuse-canonical", remember: false })),
    requestDraft: vi.fn<Options["requestDraft"]>(async () => ({ name: "Separate", description: "Purpose" })),
    getActiveView: vi.fn<Options["getActiveView"]>(() => view),
    openBlankView: vi.fn<Options["openBlankView"]>(async () => { order.push("open"); return view; }),
    revealView: vi.fn<Options["revealView"]>(async () => {}),
  } satisfies Options;
  return { launch: new DirectoryProjectLaunch(options), options, view, transport, connection, screen, order };
}
