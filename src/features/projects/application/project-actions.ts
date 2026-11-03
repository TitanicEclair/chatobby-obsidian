import type { FrontendIntentInput, FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";

type ProjectInput = Extract<FrontendIntentInput, {
  type: `projects.${string}` | "session.create" | "session.change-workspace" | "session.resume-by-id";
}>;

/** Preserve each canonical discriminant/payload pair without copying the wire schema. */
export type ProjectWireAction = ProjectInput extends infer Action
  ? Action extends ProjectInput ? Pick<Action, "type" | "payload"> : never
  : never;

type FolderAction = Extract<ProjectWireAction, { type: "projects.create" | "projects.root-add" | "projects.root-relink" }>;
type LocalFolderAction = FolderAction extends infer Action
  ? Action extends FolderAction ? {
      readonly type: Action["type"];
      readonly payload: Action["payload"] & {
        /** Device-local picker input, exchanged for an opaque runtime candidate before dispatch. */
        readonly systemAbsolutePath?: string;
      };
    } : never
  : never;
type BatchAction = Extract<ProjectWireAction, { type: "projects.roots-add-batch" }>;
type SessionCreate = Extract<ProjectWireAction, { type: "session.create" }>;
type SessionWorkspace = Extract<ProjectWireAction, { type: "session.change-workspace" }>;
type ProjectWorkspace = Extract<SessionWorkspace["payload"]["target"], { kind: "project" }>;

/** Canonical payloads with local folder input and the UI's explicit session-workspace selection. */
export type ProjectsViewIntent =
  | Exclude<ProjectWireAction, FolderAction | BatchAction | SessionCreate | SessionWorkspace>
  | LocalFolderAction
  | {
      readonly type: BatchAction["type"];
      readonly payload: Omit<BatchAction["payload"], "roots"> & {
        readonly roots: readonly (
          Omit<BatchAction["payload"]["roots"][number], "directoryCandidateRef" | "label">
          & { readonly systemAbsolutePath: string }
        )[];
      };
    }
  | {
      readonly type: SessionCreate["type"];
      readonly payload: Required<Pick<SessionCreate["payload"], "workspace">>;
    }
  | {
      readonly type: SessionWorkspace["type"];
      readonly payload: { readonly target: Required<ProjectWorkspace> };
    };

export type DirectoryProjectInput = Pick<Extract<ProjectWireAction, { type: "projects.create" }>["payload"], "name" | "description">
  & { readonly vaultRelativePath: string };

/** Registration is scoped to this operation/intent. Retry and draft lifetimes remain controller-owned. */
export async function prepareProjectAction(
  input: ProjectsViewIntent,
  intentId: string,
  register: FrontendProtocolController["registerProjectDirectoryCandidate"],
): Promise<ProjectWireAction> {
  if (
    input.type !== "projects.create" && input.type !== "projects.root-add"
    && input.type !== "projects.roots-add-batch" && input.type !== "projects.root-relink"
  ) return input;
  if (input.type === "projects.roots-add-batch") {
    const candidates = await Promise.all(input.payload.roots.map(async (root) => {
      const candidate = await register({
        schemaVersion: 1,
        intentId,
        operation: "roots-add-batch",
        absolutePath: root.systemAbsolutePath,
      });
      return {
        directoryCandidateRef: candidate.directoryCandidateRef,
        label: candidate.label,
        markerPolicy: root.markerPolicy,
        directoryReuse: root.directoryReuse,
      };
    }));
    return {
      type: input.type,
      payload: {
        projectId: input.payload.projectId,
        expectedProjectRevision: input.payload.expectedProjectRevision,
        roots: candidates,
      },
    };
  }
  const absolutePath = input.payload.systemAbsolutePath;
  if (!absolutePath) return input;
  const operation = input.type === "projects.create" ? "create" : input.type === "projects.root-add" ? "root-add" : "root-relink";
  const candidate = await register({ schemaVersion: 1, intentId, operation, absolutePath });
  if (input.type === "projects.create") {
    const { systemAbsolutePath: _systemAbsolutePath, ...payload } = input.payload;
    return { type: input.type, payload: { ...payload, directoryCandidateRef: candidate.directoryCandidateRef } };
  }
  if (input.type === "projects.root-add") {
    const { systemAbsolutePath: _systemAbsolutePath, ...payload } = input.payload;
    return {
      type: input.type,
      payload: { ...payload, label: candidate.label, directoryCandidateRef: candidate.directoryCandidateRef },
    };
  }
  const { systemAbsolutePath: _systemAbsolutePath, ...payload } = input.payload;
  return { type: input.type, payload: { ...payload, directoryCandidateRef: candidate.directoryCandidateRef } };
}
