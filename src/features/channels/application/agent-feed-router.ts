import { FileSystemAdapter, Notice, type App } from "obsidian";
import type { SessionListItem } from "../../../types";
import type { FrontendNavigationReference } from "../../../vendor/chatobby-client/frontend-contracts.js";

interface AgentFeedTransport {
  listSessions(cwd?: string, includeDescendants?: boolean): Promise<SessionListItem[]>;
}

/** Narrow view surface required to route a channel identity to its native agent feed. */
export interface AgentFeedNavigationTarget {
  readonly app: App;
  getViewType(): string;
  tabs(): Array<{ sessionId: string }>;
  ensureAgentFeedTransport(): Promise<AgentFeedTransport | null>;
  resumeAgentSession(sessionPath: string, vaultDirectoryPath: string): Promise<void>;
  switchToSession(sessionId: string): Promise<void>;
  openAgentReference(reference: FrontendNavigationReference): Promise<void>;
  openSubagentFeed(runId: string, nodeId: string): void;
  openMainFeed(): void;
}

/** Route a runtime-issued navigation reference without reconstructing channel domain state. */
export async function routeAgentReference(
  target: AgentFeedNavigationTarget,
  identity: FrontendNavigationReference,
): Promise<void> {
  const leaves = target.app.workspace.getLeavesOfType(target.getViewType());
  const targetLeaf = leaves.find((leaf) =>
    isAgentFeedTarget(leaf.view)
    && leaf.view.tabs().some((tab) => tab.sessionId === identity.mainSessionId));
  if (targetLeaf && isAgentFeedTarget(targetLeaf.view) && targetLeaf.view !== target) {
    target.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
    await targetLeaf.view.openAgentReference(identity);
    return;
  }
  if (!target.tabs().some((tab) => tab.sessionId === identity.mainSessionId)) {
    const transport = await target.ensureAgentFeedTransport();
    const vaultRoot = vaultBasePath(target.app);
    if (!transport || !vaultRoot) return void new Notice("That agent's main session could not be opened.");
    const stored = (await transport.listSessions(vaultRoot, true)).find((session) => session.id === identity.mainSessionId);
    if (!stored) return void new Notice("That agent's main session is no longer available.");
    await target.resumeAgentSession(stored.path, vaultDirectoryForCwd(vaultRoot, stored.cwd));
    const resumedLeaf = target.app.workspace.getLeavesOfType(target.getViewType()).find((leaf) =>
      isAgentFeedTarget(leaf.view)
      && leaf.view.tabs().some((tab) => tab.sessionId === identity.mainSessionId));
    if (!resumedLeaf || !isAgentFeedTarget(resumedLeaf.view)) {
      return void new Notice("That agent's main session opened, but its feed could not be selected.");
    }
    target.app.workspace.setActiveLeaf(resumedLeaf, { focus: true });
    await resumedLeaf.view.openAgentReference(identity);
    return;
  }
  await target.switchToSession(identity.mainSessionId);
  if (identity.runId && identity.nodeId) {
    target.openSubagentFeed(identity.runId, identity.nodeId);
  } else {
    target.openMainFeed();
  }
}

function isAgentFeedTarget(value: unknown): value is AgentFeedNavigationTarget {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AgentFeedNavigationTarget>;
  return typeof candidate.tabs === "function"
    && typeof candidate.openAgentReference === "function"
    && typeof candidate.switchToSession === "function";
}

function vaultBasePath(app: App): string | null {
  const adapter = app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) return null;
  const basePath = adapter.getBasePath().trim();
  return basePath || null;
}

function vaultDirectoryForCwd(vaultRoot: string, cwd: string): string {
  const root = vaultRoot.replaceAll("\\", "/").replace(/\/+$/u, "");
  const candidate = cwd.replaceAll("\\", "/").replace(/\/+$/u, "");
  if (candidate.localeCompare(root, undefined, { sensitivity: "accent" }) === 0) return "";
  const prefix = `${root}/`;
  return candidate.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())
    ? normalizeVaultDirectory(candidate.slice(prefix.length))
    : "";
}

function normalizeVaultDirectory(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/gu, "");
}
