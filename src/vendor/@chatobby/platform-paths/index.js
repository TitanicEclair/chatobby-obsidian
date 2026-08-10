// packages/chatobby-platform-paths/src/catalogue.ts
var DIRECTORY_MARKER_FILENAME = ".chatobby-root.json";
var PLATFORM_PATH_ROLE_CATALOGUE = [
  {
    role: "agent-data-root",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Installation-global agent data selected by CHATOBBY_AGENT_DIR or ~/.chatobby/agent."
  },
  {
    role: "device-data-root",
    owner: "source-runtime",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Machine-local Projects identity and recovery data selected independently from vault agent data."
  },
  {
    role: "device-bindings-root",
    owner: "source-runtime",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Device-local Project root bindings beneath the dedicated machine-local data root."
  },
  {
    role: "projects-device-identity",
    owner: "source-runtime",
    authority: "device-local",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Stable installation-local device identity used to isolate Project directory bindings."
  },
  {
    role: "projects-device-bindings-root",
    owner: "source-runtime",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Directory-binding authority root keyed by stable vault and device identity."
  },
  {
    role: "projects-marker-index",
    owner: "source-runtime",
    authority: "device-local",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Rebuildable device-local marker observation index keyed by vault and device identity."
  },
  {
    role: "projects-root-operation-journal",
    owner: "source-runtime",
    authority: "device-local",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "One durable device-local Project root-operation journal used for interruption recovery."
  },
  {
    role: "permission-profiles",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Installation-global permission profile definitions."
  },
  {
    role: "permission-config",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Installation-global permission configuration."
  },
  {
    role: "permission-logs-root",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Private permission diagnostic logs."
  },
  {
    role: "permission-vault-binding",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Scoped live permission bindings for one stable vault identity."
  },
  {
    role: "installation-migration-lock",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Private installation-global lock that serializes one migration capsule across vaults."
  },
  {
    role: "installation-migration-work",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Ephemeral installation-global migration staging for one run."
  },
  {
    role: "installation-migration-journal",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Durable installation-global migration capsule journal for one exact run."
  },
  {
    role: "installation-migration-archive",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Installation-global migration rollback archive for one run."
  },
  {
    role: "installation-migration-archive-manifest",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Immutable installation-global inventory for one migration rollback archive."
  },
  {
    role: "installation-migration-receipt",
    owner: "source-runtime",
    authority: "installation-global",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Redacted installation-global migration receipt for one run."
  },
  {
    role: "vault-state-root",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Portable .chatobby authority root inside one vault."
  },
  {
    role: "vault-identity",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Stable portable vault identity document."
  },
  {
    role: "projects-root",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Portable Project authority root inside one vault."
  },
  {
    role: "projects-index",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Rebuildable portable Project index."
  },
  {
    role: "session-workspace-bindings",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Portable Vault or Project workspace binding authority for sessions."
  },
  {
    role: "project-record",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "One portable Project record."
  },
  {
    role: "project-brief",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Optional user-authored Project guidance."
  },
  {
    role: "directory-marker",
    owner: "source-runtime",
    authority: "registered-root-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Minimal portable identity marker at a registered root."
  },
  {
    role: "vault-migration-lock",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Private vault-local lock acquired after the installation migration lock."
  },
  {
    role: "vault-migration-work",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Ephemeral vault migration staging for one run."
  },
  {
    role: "vault-migration-journal",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Durable vault-local migration capsule journal for one exact run."
  },
  {
    role: "vault-migration-archive",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Vault migration rollback archive for one run."
  },
  {
    role: "vault-migration-archive-manifest",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Immutable vault-local inventory for one migration rollback archive."
  },
  {
    role: "vault-migration-receipt",
    owner: "source-runtime",
    authority: "vault-portable",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Redacted vault migration receipt for one run."
  },
  {
    role: "runtime-data-root",
    owner: "connector",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Connector-owned runtime installation and package data root."
  },
  {
    role: "runtime-state-root",
    owner: "connector",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Connector-owned runtime state and log root."
  },
  {
    role: "runtime-versions-root",
    owner: "connector",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Connector-owned installed runtime versions."
  },
  {
    role: "runtime-version",
    owner: "connector",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "One connector-owned installed runtime version."
  },
  {
    role: "runtime-current-pointer",
    owner: "connector",
    authority: "device-local",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Connector-owned active runtime pointer."
  },
  {
    role: "runtime-leases-root",
    owner: "connector",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Connector-owned per-vault runtime lease root."
  },
  {
    role: "runtime-vault-lease",
    owner: "connector",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Connector-owned runtime lease directory for one stable vault identity."
  },
  {
    role: "runtime-log-root",
    owner: "connector",
    authority: "device-local",
    kind: "directory",
    linkPolicy: "realpath-before-admission",
    description: "Connector-owned platform log root."
  },
  {
    role: "runtime-vault-log",
    owner: "connector",
    authority: "device-local",
    kind: "file",
    linkPolicy: "ordinary-file-required",
    description: "Connector-owned bounded runtime log for one stable vault identity."
  }
];
function getPlatformPathRole(role) {
  const definition = PLATFORM_PATH_ROLE_CATALOGUE.find((candidate) => candidate.role === role);
  if (!definition) throw new Error(`Unknown Chatobby platform path role: ${role}`);
  return definition;
}

// packages/chatobby-platform-paths/src/resolver.ts
import { posix, win32 } from "node:path";
function resolveSourcePlatformPath(environment, request) {
  assertOwnedRole(request.role, "source-runtime");
  const path = dialect(environment.platform);
  switch (request.role) {
    case "agent-data-root":
      return resolveAgentDataRoot(environment);
    case "device-data-root":
      return resolveDeviceDataRoot(environment);
    case "device-bindings-root":
      return path.join(resolveDeviceDataRoot(environment), "projects", "device-bindings");
    case "projects-device-identity":
      return path.join(resolveDeviceDataRoot(environment), "projects", "device.json");
    case "projects-device-bindings-root":
      return path.join(
        resolveDeviceDataRoot(environment),
        "projects",
        "device-bindings",
        encodePlatformPathKey(request.vaultId),
        encodePlatformPathKey(request.deviceId)
      );
    case "projects-marker-index":
      return path.join(
        resolveDeviceDataRoot(environment),
        "projects",
        "marker-index",
        encodePlatformPathKey(request.vaultId),
        `${encodePlatformPathKey(request.deviceId)}.json`
      );
    case "projects-root-operation-journal":
      return path.join(
        resolveDeviceDataRoot(environment),
        "projects",
        "operations",
        encodePlatformPathKey(request.vaultId),
        encodePlatformPathKey(request.deviceId),
        `${encodePlatformPathKey(request.operationId)}.json`
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
        `${encodePlatformPathKey(request.vaultId)}.json`
      );
    case "installation-migration-lock":
      return path.join(resolveAgentDataRoot(environment), "migrations", ".installation.lock");
    case "installation-migration-work":
      return installationMigrationPath(
        path,
        resolveAgentDataRoot(environment),
        "work",
        request.migrationId,
        request.runId
      );
    case "installation-migration-journal":
      return path.join(
        installationMigrationPath(
          path,
          resolveAgentDataRoot(environment),
          "work",
          request.migrationId,
          request.runId
        ),
        "journal.json"
      );
    case "installation-migration-archive":
      return installationMigrationPath(
        path,
        resolveAgentDataRoot(environment),
        "archive",
        request.migrationId,
        request.runId
      );
    case "installation-migration-archive-manifest":
      return path.join(
        installationMigrationPath(
          path,
          resolveAgentDataRoot(environment),
          "archive",
          request.migrationId,
          request.runId
        ),
        "manifest.json"
      );
    case "installation-migration-receipt":
      return `${installationMigrationPath(
        path,
        resolveAgentDataRoot(environment),
        "receipts",
        request.migrationId,
        request.runId
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
        "index.json"
      );
    case "session-workspace-bindings":
      return path.join(
        resolveRoot(environment, request.vaultRoot, "vaultRoot"),
        ".chatobby",
        "projects",
        "session-bindings.json"
      );
    case "project-record":
      return projectPath(environment, request.vaultRoot, request.projectId, "project.json");
    case "project-brief":
      return projectPath(environment, request.vaultRoot, request.projectId, "brief.md");
    case "directory-marker":
      return path.join(
        resolveRoot(environment, request.registeredRoot, "registeredRoot"),
        DIRECTORY_MARKER_FILENAME
      );
    case "vault-migration-lock":
      return path.join(
        resolveRoot(environment, request.vaultRoot, "vaultRoot"),
        ".chatobby",
        "migrations",
        ".vault.lock"
      );
    case "vault-migration-work":
      return vaultMigrationPath(environment, request.vaultRoot, "work", request.migrationId, request.runId, false);
    case "vault-migration-journal":
      return path.join(
        vaultMigrationPath(environment, request.vaultRoot, "work", request.migrationId, request.runId, false),
        "journal.json"
      );
    case "vault-migration-archive":
      return vaultMigrationPath(
        environment,
        request.vaultRoot,
        "archive",
        request.migrationId,
        request.runId,
        false
      );
    case "vault-migration-archive-manifest":
      return path.join(
        vaultMigrationPath(environment, request.vaultRoot, "archive", request.migrationId, request.runId, false),
        "manifest.json"
      );
    case "vault-migration-receipt":
      return vaultMigrationPath(
        environment,
        request.vaultRoot,
        "receipts",
        request.migrationId,
        request.runId,
        true
      );
  }
}
function resolveConnectorPlatformPath(environment, request) {
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
function resolveAgentDataRoot(environment) {
  const path = dialect(environment.platform);
  const configured = environment.variables?.CHATOBBY_AGENT_DIR;
  if (!configured)
    return path.join(requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory"), ".chatobby", "agent");
  return resolveRoot(environment, configured, "CHATOBBY_AGENT_DIR");
}
function resolveAgentDataPath(agentDataRoot, role, platform) {
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
function resolveDeviceDataRoot(environment) {
  const configured = environment.deviceDataRoot ?? environment.variables?.CHATOBBY_DEVICE_DATA_ROOT;
  const path = dialect(environment.platform);
  if (configured) {
    const home2 = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
    const expanded = configured === "~" ? home2 : configured.startsWith("~/") || configured.startsWith("~\\") ? path.join(home2, configured.slice(2)) : configured;
    return requireAbsoluteRoot(path, expanded, "CHATOBBY_DEVICE_DATA_ROOT");
  }
  if (environment.platform === "win32") {
    const localAppData = environment.variables?.LOCALAPPDATA ?? path.join(requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory"), "AppData", "Local");
    return path.join(
      requireAbsoluteRoot(path, localAppData, "Windows local application data root"),
      "Chatobby",
      "device"
    );
  }
  if (environment.platform === "darwin") {
    return path.join(
      requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory"),
      "Library",
      "Application Support",
      "Chatobby",
      "device"
    );
  }
  const home = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
  const dataBase = absoluteXdgRoot(path, environment.variables?.XDG_DATA_HOME) ?? path.join(home, ".local", "share");
  return path.join(dataBase, "Chatobby", "device");
}
function encodePlatformPathKey(value) {
  if (value.length === 0) throw new Error("Path key must not be empty.");
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 127) throw new Error("Path key must not exceed 127 UTF-8 bytes.");
  return `k1-${encodeBase32(bytes)}`;
}
function projectPath(environment, vaultRoot, projectId, filename) {
  const path = dialect(environment.platform);
  return path.join(
    resolveRoot(environment, vaultRoot, "vaultRoot"),
    ".chatobby",
    "projects",
    encodePlatformPathKey(projectId),
    filename
  );
}
function installationMigrationPath(path, agentDir, area, migrationId, runId) {
  return path.join(agentDir, "migrations", area, encodePlatformPathKey(migrationId), encodePlatformPathKey(runId));
}
function vaultMigrationPath(environment, vaultRoot, area, migrationId, runId, isFile) {
  const path = dialect(environment.platform);
  const result = path.join(
    resolveRoot(environment, vaultRoot, "vaultRoot"),
    ".chatobby",
    "migrations",
    area,
    encodePlatformPathKey(migrationId),
    encodePlatformPathKey(runId)
  );
  return isFile ? `${result}.json` : result;
}
function resolveConnectorRoots(environment) {
  const path = dialect(environment.platform);
  const configuredData = environment.connectorDataRoot;
  const configuredState = environment.connectorStateRoot;
  if (configuredData || configuredState) {
    const data = configuredData ? resolveRoot(environment, configuredData, "connectorDataRoot") : defaultConnectorDataRoot(environment);
    return {
      data,
      state: configuredState ? resolveRoot(environment, configuredState, "connectorStateRoot") : data
    };
  }
  if (environment.platform === "win32") {
    const localAppData = environment.variables?.LOCALAPPDATA ?? path.join(requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory"), "AppData", "Local");
    const root = requireAbsoluteRoot(path, localAppData, "Windows local application data root");
    return { data: path.join(root, "Chatobby"), state: path.join(root, "Chatobby") };
  }
  if (environment.platform === "darwin") {
    const home2 = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
    return {
      data: path.join(home2, "Library", "Application Support", "Chatobby"),
      state: path.join(home2, "Library", "Logs", "Chatobby")
    };
  }
  const home = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
  const dataBase = absoluteXdgRoot(path, environment.variables?.XDG_DATA_HOME) ?? path.join(home, ".local", "share");
  const stateBase = absoluteXdgRoot(path, environment.variables?.XDG_STATE_HOME) ?? path.join(home, ".local", "state");
  return { data: path.join(dataBase, "Chatobby"), state: path.join(stateBase, "Chatobby") };
}
function encodeBase32(bytes) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let buffer = 0;
  let bits = 0;
  let output = "";
  for (const byte of bytes) {
    buffer = buffer << 8 | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += alphabet[buffer >>> bits & 31];
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) output += alphabet[buffer << 5 - bits & 31];
  return output;
}
function defaultConnectorDataRoot(environment) {
  return resolveConnectorRoots({ ...environment, connectorDataRoot: void 0, connectorStateRoot: void 0 }).data;
}
function resolveRoot(environment, input, label) {
  const path = dialect(environment.platform);
  const home = requireAbsoluteRoot(path, environment.homeDirectory, "homeDirectory");
  let expanded = input;
  if (input === "~") expanded = home;
  else if (input.startsWith("~/") || input.startsWith("~\\")) expanded = path.join(home, input.slice(2));
  if (path.isAbsolute(expanded)) return path.resolve(expanded);
  const cwd = environment.currentWorkingDirectory ? requireAbsoluteRoot(path, environment.currentWorkingDirectory, "currentWorkingDirectory") : home;
  if (!expanded) throw new Error(`${label} must not be empty.`);
  return path.resolve(cwd, expanded);
}
function absoluteXdgRoot(path, value) {
  if (!value || !path.isAbsolute(value)) return void 0;
  return path.resolve(value);
}
function requireAbsoluteRoot(path, input, label) {
  if (!path.isAbsolute(input)) throw new Error(`${label} must be an absolute path for the selected platform.`);
  return path.resolve(input);
}
function dialect(platform) {
  return platform === "win32" ? win32 : posix;
}
function assertOwnedRole(role, owner) {
  const definition = getPlatformPathRole(role);
  if (definition.owner !== owner) throw new Error(`Path role ${role} is owned by ${definition.owner}, not ${owner}.`);
}
export {
  DIRECTORY_MARKER_FILENAME,
  PLATFORM_PATH_ROLE_CATALOGUE,
  encodePlatformPathKey,
  getPlatformPathRole,
  resolveAgentDataPath,
  resolveAgentDataRoot,
  resolveConnectorPlatformPath,
  resolveDeviceDataRoot,
  resolveSourcePlatformPath
};
