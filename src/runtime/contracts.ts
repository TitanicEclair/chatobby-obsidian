import type {
  RuntimeClientHello,
  RuntimeIdentity,
  RuntimeReadyDescriptor,
} from "../vendor/chatobby-client/ws-client.js";

export type { RuntimeIdentity, RuntimeReadyDescriptor };

export type RuntimeMode = "managed" | "external" | "developer";
export type RuntimeOwnership = RuntimeMode;
export type RuntimeLifetime = "obsidian-session" | "background";

export type RuntimeFailureCode =
  | "configuration_invalid"
  | "runtime_not_installed"
  | "descriptor_invalid"
  | "identity_mismatch"
  | "authentication_failed"
  | "protocol_incompatible"
  | "spawn_failed"
  | "startup_timeout"
  | "runtime_exited"
  | "connection_failed"
  | "shutdown_failed";

export interface RuntimeDiagnostics {
  code: RuntimeFailureCode;
  message: string;
  recentLogs: string[];
  occurredAt: number;
}

export type RuntimeLifecycleState =
  | { status: "idle"; mode: RuntimeMode }
  | { status: "resolving"; mode: RuntimeMode }
  | { status: "spawning"; mode: "managed" | "developer"; attempt: number }
  | { status: "authenticating"; mode: RuntimeMode; endpoint: string }
  | { status: "ready"; runtime: ReadyRuntime; readyAt: number }
  | { status: "stopping"; mode: RuntimeMode }
  | { status: "detached"; mode: RuntimeMode }
  | { status: "error"; mode: RuntimeMode; diagnostics: RuntimeDiagnostics; retryAt?: number }
  | { status: "crash_loop"; mode: "managed" | "developer"; diagnostics: RuntimeDiagnostics };

export interface RuntimeSessionCredentials extends Omit<RuntimeClientHello, "type" | "pluginVersion"> {
  pluginVersion: string;
}

export interface ReadyRuntime {
  identity: RuntimeIdentity;
  endpoint: string;
  ownership: RuntimeOwnership;
  session?: RuntimeSessionCredentials;
}

export interface EnsureRuntimeRequest {
  reason: RuntimeActionReason;
}

export type RuntimeActionReason =
  | "view-open"
  | "user-action"
  | "provider-refresh"
  | "memory-action"
  | "permission-action"
  | "subagent-action"
  | "manual-start"
  | "manual-restart"
  | "automatic-restart";

export type RuntimeDetachReason = "plugin-unload" | "mode-change";

export interface RuntimeConfiguration {
  mode: RuntimeMode;
  lifetime: RuntimeLifetime;
  externalUrl: string;
  developerCommand: string;
  developerArgs: string[];
  shellCommand?: string;
}

export interface RuntimeInstancePaths {
  directory: string;
  descriptorFile: string;
  controlTokenFile: string;
  sessionTokenFile: string;
  logFile: string;
}

export interface RuntimeLeaseCandidate {
  descriptor: RuntimeReadyDescriptor;
  controlToken: string;
  sessionToken: string;
  paths: RuntimeInstancePaths;
}

export interface PreparedRuntimeLease {
  instanceId: string;
  vaultId: string;
  controlToken: string;
  sessionToken: string;
  paths: RuntimeInstancePaths;
}

export interface ManagedRuntimeLaunch {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  instanceId: string;
  /** Run outside the Obsidian process group and persist until an authenticated stop. */
  detached: boolean;
}

export interface ManagedProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  expected: boolean;
}

export interface ManagedProcessHandle {
  readonly pid: number;
  readonly startedAt: number;
  readonly exited: Promise<ManagedProcessExit>;
  recentLogs(): string[];
  terminate(): Promise<void>;
}
