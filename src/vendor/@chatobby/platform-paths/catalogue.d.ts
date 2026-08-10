export type PlatformPathOwner = "source-runtime" | "connector";
export type PlatformPathAuthority = "installation-global" | "device-local" | "vault-portable" | "registered-root-portable";
export type PlatformPathKind = "directory" | "file";
export type PlatformPathLinkPolicy = "lexical-only" | "ordinary-file-required" | "realpath-before-admission";
export interface PlatformPathRoleDefinition {
    readonly role: string;
    readonly owner: PlatformPathOwner;
    readonly authority: PlatformPathAuthority;
    readonly kind: PlatformPathKind;
    readonly linkPolicy: PlatformPathLinkPolicy;
    readonly description: string;
}
export declare const DIRECTORY_MARKER_FILENAME = ".chatobby-root.json";
export declare const PLATFORM_PATH_ROLE_CATALOGUE: readonly [{
    readonly role: "agent-data-root";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Installation-global agent data selected by CHATOBBY_AGENT_DIR or ~/.chatobby/agent.";
}, {
    readonly role: "device-data-root";
    readonly owner: "source-runtime";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Machine-local Projects identity and recovery data selected independently from vault agent data.";
}, {
    readonly role: "device-bindings-root";
    readonly owner: "source-runtime";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Device-local Project root bindings beneath the dedicated machine-local data root.";
}, {
    readonly role: "projects-device-identity";
    readonly owner: "source-runtime";
    readonly authority: "device-local";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Stable installation-local device identity used to isolate Project directory bindings.";
}, {
    readonly role: "projects-device-bindings-root";
    readonly owner: "source-runtime";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Directory-binding authority root keyed by stable vault and device identity.";
}, {
    readonly role: "projects-marker-index";
    readonly owner: "source-runtime";
    readonly authority: "device-local";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Rebuildable device-local marker observation index keyed by vault and device identity.";
}, {
    readonly role: "projects-root-operation-journal";
    readonly owner: "source-runtime";
    readonly authority: "device-local";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "One durable device-local Project root-operation journal used for interruption recovery.";
}, {
    readonly role: "permission-profiles";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Installation-global permission profile definitions.";
}, {
    readonly role: "permission-config";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Installation-global permission configuration.";
}, {
    readonly role: "permission-logs-root";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Private permission diagnostic logs.";
}, {
    readonly role: "permission-vault-binding";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Scoped live permission bindings for one stable vault identity.";
}, {
    readonly role: "installation-migration-lock";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Private installation-global lock that serializes one migration capsule across vaults.";
}, {
    readonly role: "installation-migration-work";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Ephemeral installation-global migration staging for one run.";
}, {
    readonly role: "installation-migration-journal";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Durable installation-global migration capsule journal for one exact run.";
}, {
    readonly role: "installation-migration-archive";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Installation-global migration rollback archive for one run.";
}, {
    readonly role: "installation-migration-archive-manifest";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Immutable installation-global inventory for one migration rollback archive.";
}, {
    readonly role: "installation-migration-receipt";
    readonly owner: "source-runtime";
    readonly authority: "installation-global";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Redacted installation-global migration receipt for one run.";
}, {
    readonly role: "vault-state-root";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Portable .chatobby authority root inside one vault.";
}, {
    readonly role: "vault-identity";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Stable portable vault identity document.";
}, {
    readonly role: "projects-root";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Portable Project authority root inside one vault.";
}, {
    readonly role: "projects-index";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Rebuildable portable Project index.";
}, {
    readonly role: "session-workspace-bindings";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Portable Vault or Project workspace binding authority for sessions.";
}, {
    readonly role: "project-record";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "One portable Project record.";
}, {
    readonly role: "project-brief";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Optional user-authored Project guidance.";
}, {
    readonly role: "directory-marker";
    readonly owner: "source-runtime";
    readonly authority: "registered-root-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Minimal portable identity marker at a registered root.";
}, {
    readonly role: "vault-migration-lock";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Private vault-local lock acquired after the installation migration lock.";
}, {
    readonly role: "vault-migration-work";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Ephemeral vault migration staging for one run.";
}, {
    readonly role: "vault-migration-journal";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Durable vault-local migration capsule journal for one exact run.";
}, {
    readonly role: "vault-migration-archive";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Vault migration rollback archive for one run.";
}, {
    readonly role: "vault-migration-archive-manifest";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Immutable vault-local inventory for one migration rollback archive.";
}, {
    readonly role: "vault-migration-receipt";
    readonly owner: "source-runtime";
    readonly authority: "vault-portable";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Redacted vault migration receipt for one run.";
}, {
    readonly role: "runtime-data-root";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Connector-owned runtime installation and package data root.";
}, {
    readonly role: "runtime-state-root";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Connector-owned runtime state and log root.";
}, {
    readonly role: "runtime-versions-root";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Connector-owned installed runtime versions.";
}, {
    readonly role: "runtime-version";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "One connector-owned installed runtime version.";
}, {
    readonly role: "runtime-current-pointer";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Connector-owned active runtime pointer.";
}, {
    readonly role: "runtime-leases-root";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Connector-owned per-vault runtime lease root.";
}, {
    readonly role: "runtime-vault-lease";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Connector-owned runtime lease directory for one stable vault identity.";
}, {
    readonly role: "runtime-log-root";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "directory";
    readonly linkPolicy: "realpath-before-admission";
    readonly description: "Connector-owned platform log root.";
}, {
    readonly role: "runtime-vault-log";
    readonly owner: "connector";
    readonly authority: "device-local";
    readonly kind: "file";
    readonly linkPolicy: "ordinary-file-required";
    readonly description: "Connector-owned bounded runtime log for one stable vault identity.";
}];
export type PlatformPathRole = (typeof PLATFORM_PATH_ROLE_CATALOGUE)[number]["role"];
export type SourcePlatformPathRole = Extract<(typeof PLATFORM_PATH_ROLE_CATALOGUE)[number], {
    owner: "source-runtime";
}>["role"];
export type ConnectorPlatformPathRole = Extract<(typeof PLATFORM_PATH_ROLE_CATALOGUE)[number], {
    owner: "connector";
}>["role"];
export declare function getPlatformPathRole(role: PlatformPathRole): PlatformPathRoleDefinition;
