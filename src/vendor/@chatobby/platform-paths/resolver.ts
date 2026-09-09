import { posix, win32 } from "node:path";
import type { DeviceId, ProjectId, VaultId } from "@chatobby/project-contracts";
import type { ConnectorPlatformPathRole, SourcePlatformPathRole } from "./catalogue.ts";
import { DIRECTORY_MARKER_FILENAME, getPlatformPathRole } from "./catalogue.ts";

export type ChatobbyPlatform = "win32" | "darwin" | "linux";
export type AgentDataPathRole = "permission-profiles" | "permission-config" | "permission-logs-root";

export interface ChatobbyPlatformPathEnvironment {
	readonly platform: ChatobbyPlatform;
	readonly homeDirectory: string;
	readonly currentWorkingDirectory?: string;
	readonly variables?: Readonly<{
		CHATOBBY_AGENT_DIR?: string;
		CHATOBBY_DEVICE_DATA_ROOT?: string;
		LOCALAPPDATA?: string;
		XDG_DATA_HOME?: string;
		XDG_STATE_HOME?: string;
	}>;
	readonly deviceDataRoot?: string;
	readonly connectorDataRoot?: string;
	readonly connectorStateRoot?: string;
}

export type SourcePlatformPathRequest =
	| {
			readonly role: "agent-data-root" | "permission-profiles" | "permission-config" | "permission-logs-root";
	  }
	| {
			readonly role:
				| "device-data-root"
				| "device-bindings-root"
				| "native-sandbox-root"
				| "projects-device-identity"
				| "projects-rootless-workspaces-root"
				| "local-models-root"
				| "local-model-server-profiles";
	  }
	| { readonly role: "local-model-server-state-root"; readonly profileId: string }
	| { readonly role: "projects-device-bindings-root"; readonly vaultId: VaultId; readonly deviceId: DeviceId }
	| { readonly role: "projects-marker-index"; readonly vaultId: VaultId; readonly deviceId: DeviceId }
	| {
			readonly role: "projects-root-operation-journal";
			readonly vaultId: VaultId;
			readonly deviceId: DeviceId;
			readonly operationId: string;
	  }
	| { readonly role: "permission-vault-binding"; readonly vaultId: VaultId }
	| { readonly role: "installation-migration-lock" }
	| {
			readonly role:
				| "installation-migration-work"
				| "installation-migration-journal"
				| "installation-migration-archive"
				| "installation-migration-archive-manifest"
				| "installation-migration-receipt";
			readonly migrationId: string;
			readonly runId: string;
	  }
	| {
			readonly role:
				| "vault-state-root"
				| "vault-identity"
				| "projects-root"
				| "projects-index"
				| "session-workspace-bindings";
			readonly vaultRoot: string;
	  }
	| { readonly role: "project-record" | "project-brief"; readonly vaultRoot: string; readonly projectId: ProjectId }
	| { readonly role: "directory-marker"; readonly registeredRoot: string }
	| { readonly role: "vault-migration-lock"; readonly vaultRoot: string }
	| {
			readonly role:
				| "vault-migration-work"
				| "vault-migration-journal"
				| "vault-migration-archive"
				| "vault-migration-archive-manifest"
				| "vault-migration-receipt";
			readonly vaultRoot: string;
			readonly migrationId: string;
			readonly runId: string;
	  };

export type ConnectorPlatformPathRequest =
	| {
			readonly role:
				| "runtime-data-root"
				| "runtime-state-root"
				| "runtime-versions-root"
				| "runtime-development-pairs-root"
				| "runtime-current-pointer"
				| "runtime-leases-root"
				| "runtime-log-root";
	  }
	| { readonly role: "runtime-version"; readonly version: string }
	| { readonly role: "runtime-vault-lease" | "runtime-vault-log"; readonly vaultId: VaultId };

export function resolveSourcePlatformPath(
	environment: ChatobbyPlatformPathEnvironment,
	request: SourcePlatformPathRequest,
): string {
	assertOwnedRole(request.role, "source-runtime");
	const path = dialect(environment.platform);
	switch (request.role) {
		case "agent-data-root":
			return resolveAgentDataRoot(environment);
		case "device-data-root":
			return resolveDeviceDataRoot(environment);
		case "device-bindings-root":
			return path.join(resolveDeviceDataRoot(environment), "projects", "device-bindings");
		case "native-sandbox-root":
			return path.join(resolveDeviceDataRoot(environment), "sandbox");
		case "projects-device-identity":
			return path.join(resolveDeviceDataRoot(environment), "projects", "device.json");
		case "projects-rootless-workspaces-root":
			return path.join(resolveDeviceDataRoot(environment), "projects", "rootless-workspaces");
		case "local-models-root":
			return path.join(resolveDeviceDataRoot(environment), "local-models");
		case "local-model-server-profiles":
			return path.join(resolveDeviceDataRoot(environment), "local-models", "servers.json");
		case "local-model-server-state-root":
			return path.join(
				resolveDeviceDataRoot(environment),
				"local-models",
				"servers",
				encodePlatformPathKey(request.profileId),
			);
		case "projects-device-bindings-root":
			return path.join(
				resolveDeviceDataRoot(environment),
				"projects",
				"device-bindings",
				encodePlatformPathKey(request.vaultId),
				encodePlatformPathKey(request.deviceId),
			);
		case "projects-marker-index":
			return path.join(
				resolveDeviceDataRoot(environment),
				"projects",
				"marker-index",
				encodePlatformPathKey(request.vaultId),
				`${encodePlatformPathKey(request.deviceId)}.json`,
			);
		case "projects-root-operation-journal":
			return path.join(
				resolveDeviceDataRoot(environment),
				"projects",
				"operations",
				encodePlatformPathKey(request.vaultId),
				encodePlatformPathKey(request.deviceId),
				`${encodePlatformPathKey(request.operationId)}.json`,
			);
		case "permission-profiles":
			return resolveAgentDataPath(resolveAgentDataRoot(environment), request.role, environment.platform);
		case "permission-config":
			return resolveAgentDataPath(resolveAgentDataRoot(environment), request.role, environment.platform);
		case "permission-logs-root":
			return resolveAgentDataPath(resolveAgentDataRoot(environment), request.role, environment.platform);
		case "permission-vault-binding":
			return path.join(
				resolveAgentDataRoot(environment),
				"permissions",
				"bindings",
				`${encodePlatformPathKey(request.vaultId)}.json`,
			);
		case "installation-migration-lock":
			return path.join(resolveAgentDataRoot(environment), "migrations", ".installation.lock");
		case "installation-migration-work":
			return installationMigrationPath(
				path,
				resolveAgentDataRoot(environment),
				"work",
				request.migrationId,
				request.runId,
			);
		case "installation-migration-journal":
			return path.join(
				installationMigrationPath(
					path,
					resolveAgentDataRoot(environment),
					"work",
					request.migrationId,
					request.runId,
				),
				"journal.json",
			);
		case "installation-migration-archive":
			return installationMigrationPath(
				path,
				resolveAgentDataRoot(environment),
				"archive",
				request.migrationId,
				request.runId,
			);
		case "installation-migration-archive-manifest":
			return path.join(
				installationMigrationPath(
					path,
					resolveAgentDataRoot(environment),
					"archive",
					request.migrationId,
					request.runId,
				),
				"manifest.json",
			);
		case "installation-migration-receipt":
			return `${installationMigrationPath(
				path,
				resolveAgentDataRoot(environment),
				"receipts",
				request.migrationId,
				request.runId,
			)}.json`;
		case "vault-state-root":
			return path.join(resolveRoot(environment, request.vaultRoot, "vaultRoot"), ".chatobby");
		case "vault-identity":
			return path.join(resolveRoot(environment, request.vaultRoot, "vaultRoot"), ".chatobby", "vault.json");
		case "projects-root":
			return path.join(resolveRoot(environment, request.vaultRoot, "vaultRoot"), ".chatobby", "projects");
		case "projects-index":
			return path.join(
				resolveRoot(environment, request.vaultRoot, "vaultRoot"),
				".chatobby",
				"projects",
				"index.json",
			);
		case "session-workspace-bindings":
			return path.join(
				resolveRoot(environment, request.vaultRoot, "vaultRoot"),
				".chatobby",
				"projects",
				"session-bindings.json",
			);
		case "project-record":
			return projectPath(environment, request.vaultRoot, request.projectId, "project.json");
		case "project-brief":
			return projectPath(environment, request.vaultRoot, request.projectId, "brief.md");
		case "directory-marker":
			return path.join(
				resolveRoot(environment, request.registeredRoot, "registeredRoot"),
				DIRECTORY_MARKER_FILENAME,
			);
		case "vault-migration-lock":
			return path.join(
				resolveRoot(environment, request.vaultRoot, "vaultRoot"),
				".chatobby",
				"migrations",
				".vault.lock",
			);
		case "vault-migration-work":
			return vaultMigrationPath(environment, request.vaultRoot, "work", request.migrationId, request.runId, false);
		case "vault-migration-journal":
			return path.join(
				vaultMigrationPath(environment, request.vaultRoot, "work", request.migrationId, request.runId, false),
				"journal.json",
			);
		case "vault-migration-archive":
			return vaultMigrationPath(
				environment,
				request.vaultRoot,
				"archive",
				request.migrationId,
				request.runId,
				false,
			);
		case "vault-migration-archive-manifest":
			return path.join(
				vaultMigrationPath(environment, request.vaultRoot, "archive", request.migrationId, request.runId, false),
				"manifest.json",
			);
		case "vault-migration-receipt":
			return vaultMigrationPath(
				environment,
				request.vaultRoot,
				"receipts",
				request.migrationId,
				request.runId,
				true,
			);
	}
}

export function resolveConnectorPlatformPath(
	environment: ChatobbyPlatformPathEnvironment,
	request: ConnectorPlatformPathRequest,
): string {
	assertOwnedRole(request.role, "connector");
	const path = dialect(environment.platform);
	const roots = resolveConnectorRoots(environment);
	switch (request.role) {
		case "runtime-data-root":
			return roots.data;
		case "runtime-state-root":
			return roots.state;
		case "runtime-versions-root":
			return path.join(roots.data, "runtime", "versions");
		case "runtime-development-pairs-root":
			return path.join(roots.data, "runtime", "development-pairs");
		case "runtime-version":
			return path.join(roots.data, "runtime", "versions", encodePlatformPathKey(request.version));
		case "runtime-current-pointer":
			return path.join(roots.data, "runtime", "current.json");
		case "runtime-leases-root":
			return path.join(roots.data, "runtimes");
		case "runtime-vault-lease":
			return path.join(roots.data, "runtimes", encodePlatformPathKey(request.vaultId));
		case "runtime-log-root":
			return roots.state;
		case "runtime-vault-log":
			return path.join(roots.state, encodePlatformPathKey(request.vaultId), "runtime.log");
	}
}

export function resolveAgentDataRoot(environment: ChatobbyPlatformPathEnvironment): string {
	const path = dialect(environment.platform);
	const configured = environment.variables?.CHATOBBY_AGENT_DIR;
	if (!configured)
		return path.join(requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory"), ".chatobby", "agent");
	return resolveRoot(environment, configured, "CHATOBBY_AGENT_DIR");
}

/** Resolve an installation-global path from an already selected agent-data root. */
export function resolveAgentDataPath(
	agentDataRoot: string,
	role: AgentDataPathRole,
	platform: ChatobbyPlatform,
): string {
	if (!agentDataRoot.trim() || agentDataRoot.includes("\0")) throw new Error("Agent data root is invalid.");
	const path = dialect(platform);
	switch (role) {
		case "permission-profiles":
			return path.join(agentDataRoot, "permissions", "profiles.json");
		case "permission-config":
			return path.join(agentDataRoot, "permissions", "config.json");
		case "permission-logs-root":
			return path.join(agentDataRoot, "permissions", "logs");
	}
}

export function resolveDeviceDataRoot(environment: ChatobbyPlatformPathEnvironment): string {
	const configured = environment.deviceDataRoot ?? environment.variables?.CHATOBBY_DEVICE_DATA_ROOT;
	const path = dialect(environment.platform);
	if (configured) {
		const home = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
		const expanded =
			configured === "~"
				? home
				: configured.startsWith("~/") || configured.startsWith("~\\")
					? path.join(home, configured.slice(2))
					: configured;
		return requireAbsoluteRoot(path, expanded, "CHATOBBY_DEVICE_DATA_ROOT");
	}
	if (environment.platform === "win32") {
		const localAppData =
			environment.variables?.LOCALAPPDATA ??
			path.join(requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory"), "AppData", "Local");
		return path.join(
			requireAbsoluteRoot(path, localAppData, "Windows local application data root"),
			"Chatobby",
			"device",
		);
	}
	if (environment.platform === "darwin") {
		return path.join(
			requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory"),
			"Library",
			"Application Support",
			"Chatobby",
			"device",
		);
	}
	const home = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
	const dataBase = absoluteXdgRoot(path, environment.variables?.XDG_DATA_HOME) ?? path.join(home, ".local", "share");
	return path.join(dataBase, "Chatobby", "device");
}

export function encodePlatformPathKey(value: string): string {
	if (value.length === 0) throw new Error("Path key must not be empty.");
	const bytes = new TextEncoder().encode(value);
	if (bytes.length > 127) throw new Error("Path key must not exceed 127 UTF-8 bytes.");
	return `k1-${encodeBase32(bytes)}`;
}

function projectPath(
	environment: ChatobbyPlatformPathEnvironment,
	vaultRoot: string,
	projectId: ProjectId,
	filename: string,
): string {
	const path = dialect(environment.platform);
	return path.join(
		resolveRoot(environment, vaultRoot, "vaultRoot"),
		".chatobby",
		"projects",
		encodePlatformPathKey(projectId),
		filename,
	);
}

function installationMigrationPath(
	path: typeof posix,
	agentDir: string,
	area: "work" | "archive" | "receipts",
	migrationId: string,
	runId: string,
): string {
	return path.join(agentDir, "migrations", area, encodePlatformPathKey(migrationId), encodePlatformPathKey(runId));
}

function vaultMigrationPath(
	environment: ChatobbyPlatformPathEnvironment,
	vaultRoot: string,
	area: "work" | "archive" | "receipts",
	migrationId: string,
	runId: string,
	isFile: boolean,
): string {
	const path = dialect(environment.platform);
	const result = path.join(
		resolveRoot(environment, vaultRoot, "vaultRoot"),
		".chatobby",
		"migrations",
		area,
		encodePlatformPathKey(migrationId),
		encodePlatformPathKey(runId),
	);
	return isFile ? `${result}.json` : result;
}

function resolveConnectorRoots(environment: ChatobbyPlatformPathEnvironment): { data: string; state: string } {
	const path = dialect(environment.platform);
	const configuredData = environment.connectorDataRoot;
	const configuredState = environment.connectorStateRoot;
	if (configuredData || configuredState) {
		const data = configuredData
			? resolveRoot(environment, configuredData, "connectorDataRoot")
			: defaultConnectorDataRoot(environment);
		return {
			data,
			state: configuredState ? resolveRoot(environment, configuredState, "connectorStateRoot") : data,
		};
	}
	if (environment.platform === "win32") {
		const localAppData =
			environment.variables?.LOCALAPPDATA ??
			path.join(requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory"), "AppData", "Local");
		const root = requireAbsoluteRoot(path, localAppData, "Windows local application data root");
		return { data: path.join(root, "Chatobby"), state: path.join(root, "Chatobby") };
	}
	if (environment.platform === "darwin") {
		const home = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
		return {
			data: path.join(home, "Library", "Application Support", "Chatobby"),
			state: path.join(home, "Library", "Logs", "Chatobby"),
		};
	}
	const home = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
	const dataBase = absoluteXdgRoot(path, environment.variables?.XDG_DATA_HOME) ?? path.join(home, ".local", "share");
	const stateBase = absoluteXdgRoot(path, environment.variables?.XDG_STATE_HOME) ?? path.join(home, ".local", "state");
	return { data: path.join(dataBase, "Chatobby"), state: path.join(stateBase, "Chatobby") };
}

function encodeBase32(bytes: Uint8Array): string {
	const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
	let buffer = 0;
	let bits = 0;
	let output = "";
	for (const byte of bytes) {
		buffer = (buffer << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			output += alphabet[(buffer >>> bits) & 31];
		}
		buffer &= (1 << bits) - 1;
	}
	if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
	return output;
}

function defaultConnectorDataRoot(environment: ChatobbyPlatformPathEnvironment): string {
	return resolveConnectorRoots({ ...environment, connectorDataRoot: undefined, connectorStateRoot: undefined }).data;
}

function resolveRoot(environment: ChatobbyPlatformPathEnvironment, input: string, label: string): string {
	const path = dialect(environment.platform);
	const home = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
	let expanded = input;
	if (input === "~") expanded = home;
	else if (input.startsWith("~/") || input.startsWith("~\\")) expanded = path.join(home, input.slice(2));
	if (path.isAbsolute(expanded)) return path.resolve(expanded);
	const cwd = environment.currentWorkingDirectory
		? requireAbsoluteRoot(path, environment.currentWorkingDirectory, "currentWorkingDirectory")
		: home;
	if (!expanded) throw new Error(`${label} must not be empty.`);
	return path.resolve(cwd, expanded);
}

function absoluteXdgRoot(path: typeof posix, value: string | undefined): string | undefined {
	if (!value || !path.isAbsolute(value)) return undefined;
	return path.resolve(value);
}

function requireAbsoluteRoot(path: typeof posix, input: string, label: string): string {
	if (!path.isAbsolute(input)) throw new Error(`${label} must be an absolute path for the selected platform.`);
	return path.resolve(input);
}

function dialect(platform: ChatobbyPlatform): typeof posix {
	return platform === "win32" ? win32 : posix;
}

function assertOwnedRole(
	role: SourcePlatformPathRole | ConnectorPlatformPathRole,
	owner: "source-runtime" | "connector",
): void {
	const definition = getPlatformPathRole(role);
	if (definition.owner !== owner) throw new Error(`Path role ${role} is owned by ${definition.owner}, not ${owner}.`);
}
