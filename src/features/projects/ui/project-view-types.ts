import type { App } from "obsidian";
import type { FrontendProjectScreenViewModel, FrontendProjectSessionViewModel, FrontendProjectMessageSearchHitViewModel } from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { SessionAdvancedAction } from "../../../ui/session/session-maintenance";
import type { ProjectCreationDraftSnapshot, ProjectDraftMarkerPolicy } from "../application/project-creation-draft";
import type { ProjectsViewIntent } from "../application/project-actions";

/** Native view inputs; all durable models and actions retain their canonical owners. */
export interface ProjectsViewProps {
  app: App;
  getModel(): FrontendProjectScreenViewModel | null;
  subscribe(listener: (model: FrontendProjectScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onIntent(intent: ProjectsViewIntent): Promise<void>;
  getCreationDraft(): ProjectCreationDraftSnapshot;
  resetCreationDraft(): void;
  updateCreationDraft(patch: { readonly name?: string; readonly description?: string }): void;
  setCreationMarkerPolicy(markerPolicy: ProjectDraftMarkerPolicy): void;
  addCreationFolders(paths: readonly string[]): Promise<void>;
  removeCreationFolder(directoryCandidateRef: string): void;
  makeCreationFolderPrimary(directoryCandidateRef: string): void;
  submitCreationDraft(): Promise<boolean>;
  onDeleteSession(sessionId: string): Promise<void>;
  onSessionAction(sessionId: string, action: SessionAdvancedAction): Promise<void>;
  onMessageHit(hit: FrontendProjectMessageSearchHitViewModel): Promise<void>;
}
export type SessionWorkspace = FrontendProjectSessionViewModel["workspace"];
export type ProjectViewPatch = Partial<Pick<FrontendProjectScreenViewModel,
  "query" | "lifecycleFilter" | "availabilityFilter" | "sort" | "sessionQuery"
  | "sessionSearchMode" | "sessionSort" | "sessionSearchPage" | "selectedProjectId">>;

/** One view-wide operation owner; leaf renderers never create competing busy/error locks. */
export interface ProjectPresentationActions {
  isBusy(): boolean;
  run(action: string, intent: ProjectsViewIntent): Promise<boolean>;
  runAction(action: string, operation: () => Promise<void>): Promise<boolean>;
}
