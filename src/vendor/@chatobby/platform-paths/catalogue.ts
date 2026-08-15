export type PlatformPathOwner = "source-runtime" | "connector";
export type PlatformPathAuthority =
	| "installation-global"
	| "device-local"
	| "vault-portable"
	| "registered-root-portable";
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

export const DIRECTORY_MARKER_FILENAME = ".chatobby-root.json";

export const PLATFORM_PATH_ROLE_CATALOGUE = [
	{
		role: "agent-data-root",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Installation-global agent data selected by CHATOBBY_AGENT_DIR or ~/.chatobby/agent.",
	},
	{
		role: "device-data-root",
		owner: "source-runtime",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Machine-local Projects identity and recovery data selected independently from vault agent data.",
	},
	{
		role: "device-bindings-root",
		owner: "source-runtime",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Device-local Project root bindings beneath the dedicated machine-local data root.",
	},
	{
		role: "projects-device-identity",
		owner: "source-runtime",
		authority: "device-local",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Stable installation-local device identity used to isolate Project directory bindings.",
	},
	{
		role: "projects-device-bindings-root",
		owner: "source-runtime",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Directory-binding authority root keyed by stable vault and device identity.",
	},
	{
		role: "projects-marker-index",
		owner: "source-runtime",
		authority: "device-local",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Rebuildable device-local marker observation index keyed by vault and device identity.",
	},
	{
		role: "projects-root-operation-journal",
		owner: "source-runtime",
		authority: "device-local",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "One durable device-local Project root-operation journal used for interruption recovery.",
	},
	{
		role: "local-models-root",
		owner: "source-runtime",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Device-local managed model-server profiles, ownership locks, state, and bounded logs.",
	},
	{
		role: "local-model-server-profiles",
		owner: "source-runtime",
		authority: "device-local",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Device-local managed model-server profile document without credential values.",
	},
	{
		role: "local-model-server-state-root",
		owner: "source-runtime",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Per-profile private state, ownership locks, and bounded logs for managed model servers.",
	},
	{
		role: "permission-profiles",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Installation-global permission profile definitions.",
	},
	{
		role: "permission-config",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Installation-global permission configuration.",
	},
	{
		role: "permission-logs-root",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Private permission diagnostic logs.",
	},
	{
		role: "permission-vault-binding",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Scoped live permission bindings for one stable vault identity.",
	},
	{
		role: "installation-migration-lock",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Private installation-global lock that serializes one migration capsule across vaults.",
	},
	{
		role: "installation-migration-work",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Ephemeral installation-global migration staging for one run.",
	},
	{
		role: "installation-migration-journal",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Durable installation-global migration capsule journal for one exact run.",
	},
	{
		role: "installation-migration-archive",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Installation-global migration rollback archive for one run.",
	},
	{
		role: "installation-migration-archive-manifest",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Immutable installation-global inventory for one migration rollback archive.",
	},
	{
		role: "installation-migration-receipt",
		owner: "source-runtime",
		authority: "installation-global",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Redacted installation-global migration receipt for one run.",
	},
	{
		role: "vault-state-root",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Portable .chatobby authority root inside one vault.",
	},
	{
		role: "vault-identity",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Stable portable vault identity document.",
	},
	{
		role: "projects-root",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Portable Project authority root inside one vault.",
	},
	{
		role: "projects-index",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Rebuildable portable Project index.",
	},
	{
		role: "session-workspace-bindings",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Portable Vault or Project workspace binding authority for sessions.",
	},
	{
		role: "project-record",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "One portable Project record.",
	},
	{
		role: "project-brief",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Optional user-authored Project guidance.",
	},
	{
		role: "directory-marker",
		owner: "source-runtime",
		authority: "registered-root-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Minimal portable identity marker at a registered root.",
	},
	{
		role: "vault-migration-lock",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Private vault-local lock acquired after the installation migration lock.",
	},
	{
		role: "vault-migration-work",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Ephemeral vault migration staging for one run.",
	},
	{
		role: "vault-migration-journal",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Durable vault-local migration capsule journal for one exact run.",
	},
	{
		role: "vault-migration-archive",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Vault migration rollback archive for one run.",
	},
	{
		role: "vault-migration-archive-manifest",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Immutable vault-local inventory for one migration rollback archive.",
	},
	{
		role: "vault-migration-receipt",
		owner: "source-runtime",
		authority: "vault-portable",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Redacted vault migration receipt for one run.",
	},
	{
		role: "runtime-data-root",
		owner: "connector",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Connector-owned runtime installation and package data root.",
	},
	{
		role: "runtime-state-root",
		owner: "connector",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Connector-owned runtime state and log root.",
	},
	{
		role: "runtime-versions-root",
		owner: "connector",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Connector-owned installed runtime versions.",
	},
	{
		role: "runtime-version",
		owner: "connector",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "One connector-owned installed runtime version.",
	},
	{
		role: "runtime-current-pointer",
		owner: "connector",
		authority: "device-local",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Connector-owned active runtime pointer.",
	},
	{
		role: "runtime-leases-root",
		owner: "connector",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Connector-owned per-vault runtime lease root.",
	},
	{
		role: "runtime-vault-lease",
		owner: "connector",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Connector-owned runtime lease directory for one stable vault identity.",
	},
	{
		role: "runtime-log-root",
		owner: "connector",
		authority: "device-local",
		kind: "directory",
		linkPolicy: "realpath-before-admission",
		description: "Connector-owned platform log root.",
	},
	{
		role: "runtime-vault-log",
		owner: "connector",
		authority: "device-local",
		kind: "file",
		linkPolicy: "ordinary-file-required",
		description: "Connector-owned bounded runtime log for one stable vault identity.",
	},
] as const satisfies readonly PlatformPathRoleDefinition[];

export type PlatformPathRole = (typeof PLATFORM_PATH_ROLE_CATALOGUE)[number]["role"];
export type SourcePlatformPathRole = Extract<
	(typeof PLATFORM_PATH_ROLE_CATALOGUE)[number],
	{ owner: "source-runtime" }
>["role"];
export type ConnectorPlatformPathRole = Extract<
	(typeof PLATFORM_PATH_ROLE_CATALOGUE)[number],
	{ owner: "connector" }
>["role"];

export function getPlatformPathRole(role: PlatformPathRole): PlatformPathRoleDefinition {
	const definition = PLATFORM_PATH_ROLE_CATALOGUE.find((candidate) => candidate.role === role);
	if (!definition) throw new Error(`Unknown Chatobby platform path role: ${role}`);
	return definition;
}
