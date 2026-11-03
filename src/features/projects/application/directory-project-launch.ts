import type { PluginSettings } from "../../../types";
import type { ChatobbyTransport } from "../../../transport/ws-client";
import {
  frontendId,
  type FrontendNegotiationRequest,
  type FrontendProjectSummaryViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { DirectoryProjectInput } from "./project-actions";

export interface DirectoryProjectDecision {
  readonly action: Exclude<PluginSettings["directoryProjectLaunchBehavior"], "ask">;
  readonly remember: boolean;
}

export type DirectoryProjectDraft = Pick<DirectoryProjectInput, "name" | "description">;

interface DirectoryProjectView {
  createProjectForCurrentSession(input: DirectoryProjectInput): Promise<void>;
  createSessionForProject(projectId: string): Promise<void>;
  openProjectSessions(projectId: string): Promise<void>;
  commandOpenPage(page: "projects"): void;
}

export interface DirectoryProjectLaunchOptions<View extends DirectoryProjectView> {
  ensureRuntime(): Promise<unknown>;
  ensureUtilityTransport(): Promise<Pick<ChatobbyTransport, "isConnected" | "negotiateFrontend" | "subscribeFrontend" | "getFrontendScreen">>;
  negotiationRequest(viewId: string): FrontendNegotiationRequest;
  getLaunchBehavior(): PluginSettings["directoryProjectLaunchBehavior"];
  rememberLaunchBehavior(action: DirectoryProjectDecision["action"]): Promise<void>;
  requestDecision(input: {
    readonly projectName: string;
    readonly vaultRelativePath: string;
  }): Promise<DirectoryProjectDecision | null>;
  requestDraft(vaultRelativePath: string): Promise<DirectoryProjectDraft | null>;
  getActiveView(): View | null;
  openBlankView(vaultDirectoryPath?: string): Promise<View>;
  revealView(view: View): Promise<void>;
}

/** File-explorer workflow over runtime-owned canonical Projects; never interprets folder markers. */
export class DirectoryProjectLaunch<View extends DirectoryProjectView> {
  constructor(private readonly options: DirectoryProjectLaunchOptions<View>) {}

  async start(vaultDirectoryPath: string): Promise<void> {
    const canonical = await this.findCanonicalProject(vaultDirectoryPath);
    if (!canonical) {
      const view = await this.options.openBlankView(vaultDirectoryPath);
      await view.createProjectForCurrentSession({
        name: projectNameFromDirectory(vaultDirectoryPath),
        vaultRelativePath: vaultDirectoryPath,
      });
      return;
    }
    let action = this.options.getLaunchBehavior();
    if (action === "ask") {
      const decision = await this.options.requestDecision({
        projectName: canonical.name,
        vaultRelativePath: vaultDirectoryPath,
      });
      if (!decision) return;
      action = decision.action;
      if (decision.remember) await this.options.rememberLaunchBehavior(decision.action);
    }
    if (action === "reuse-canonical") {
      const view = await this.options.openBlankView(vaultDirectoryPath);
      await view.createSessionForProject(canonical.projectId);
      return;
    }
    await this.create(vaultDirectoryPath);
  }

  async create(vaultDirectoryPath: string): Promise<void> {
    const draft = await this.options.requestDraft(vaultDirectoryPath);
    if (!draft) return;
    const view = await this.options.openBlankView(vaultDirectoryPath);
    await view.createProjectForCurrentSession({
      name: draft.name,
      ...(draft.description ? { description: draft.description } : {}),
      vaultRelativePath: vaultDirectoryPath,
    });
  }

  async browse(vaultDirectoryPath: string): Promise<void> {
    const canonical = await this.findCanonicalProject(vaultDirectoryPath);
    if (!canonical) {
      const view = this.options.getActiveView() ?? await this.options.openBlankView();
      await this.options.revealView(view);
      view.commandOpenPage("projects");
      return;
    }
    const view = await this.options.openBlankView(vaultDirectoryPath);
    await view.openProjectSessions(canonical.projectId);
  }

  private async findCanonicalProject(vaultDirectoryPath: string): Promise<FrontendProjectSummaryViewModel | undefined> {
    await this.options.ensureRuntime();
    const transport = await this.options.ensureUtilityTransport();
    if (!transport.isConnected) throw new Error("Chatobby runtime did not connect.");
    const negotiation = await transport.negotiateFrontend(
      this.options.negotiationRequest("chatobby-project-directory-probe"),
    );
    const subscription = await transport.subscribeFrontend({
      schemaVersion: 1,
      protocolVersion: negotiation.protocolVersion,
      requestId: frontendId(crypto.randomUUID(), "requestId"),
      runtimeInstanceId: negotiation.runtimeInstanceId,
      viewId: negotiation.viewId,
    });
    if (subscription.status === "resync-required") throw new Error(subscription.error.message);
    const response = await transport.getFrontendScreen({
      schemaVersion: 1,
      protocolVersion: negotiation.protocolVersion,
      runtimeInstanceId: negotiation.runtimeInstanceId,
      viewId: negotiation.viewId,
      requestId: frontendId(crypto.randomUUID(), "requestId"),
      requestEpoch: 1,
      baseSequence: subscription.sequence,
      screenId: "projects",
    });
    const screen = response.screen;
    if (screen.screenId !== "projects") throw new Error("Chatobby returned the wrong Project screen.");
    const normalized = normalizeVaultDirectoryPath(vaultDirectoryPath);
    return screen.projects.find((project) =>
      project.lifecycle === "active"
      && normalizeVaultDirectoryPath(project.canonicalVaultRelativePath ?? "") === normalized,
    );
  }
}

function normalizeVaultDirectoryPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
}

function projectNameFromDirectory(value: string): string {
  return normalizeVaultDirectoryPath(value).split("/").filter(Boolean).at(-1) ?? "New Project";
}
