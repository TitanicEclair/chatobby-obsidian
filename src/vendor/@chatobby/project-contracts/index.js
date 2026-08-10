// packages/chatobby-project-contracts/src/errors.ts
var PROJECT_ERROR_CODES = [
  "PROJECT_CONTRACT_INVALID",
  "PROJECT_UNKNOWN_SCHEMA_VERSION",
  "PROJECT_REVISION_CONFLICT",
  "PROJECT_COMMAND_ID_CONFLICT",
  "PROJECT_ALREADY_EXISTS",
  "PROJECT_NOT_FOUND",
  "PROJECT_ROOT_NOT_FOUND",
  "PROJECT_ROOT_UNAVAILABLE",
  "PROJECT_PRIMARY_ROOT_INVALID",
  "PROJECT_DUPLICATE_ROOT",
  "PROJECT_CANONICAL_REUSE_CONFLICT",
  "PROJECT_DIRECTORY_MARKER_INVALID",
  "PROJECT_DIRECTORY_MARKER_CONFLICT",
  "PROJECT_DIRECTORY_BINDING_CONFLICT",
  "PROJECT_DIRECTORY_CANDIDATE_INVALID",
  "PROJECT_DEVICE_IDENTITY_INVALID",
  "PROJECT_ROOT_IN_USE",
  "PROJECT_ROOT_RELINK_REQUIRED",
  "PROJECT_ROOT_RECOVERY_CANCELLED",
  "PROJECT_ROOT_RECOVERY_TIMEOUT",
  "PROJECT_ROOT_OPERATION_BLOCKED",
  "PROJECT_ROOT_OPERATION_INTERRUPTED",
  "PROJECT_ROOT_OPERATION_UNRECOVERABLE",
  "PROJECT_SESSION_PREFLIGHT_REQUIRED",
  "PROJECT_PATH_UNSAFE",
  "PROJECT_REFERENCE_MISSING",
  "PROJECT_BRIEF_CONTENT_CHANGED",
  "PROJECT_STORE_BUSY",
  "PROJECT_STORE_CORRUPT",
  "PROJECT_INTERRUPTED_WRITE"
];
var ProjectContractError = class extends Error {
  constructor(code, message, detail = { retryable: false }) {
    super(message);
    this.name = "ProjectContractError";
    this.detail = Object.freeze({ schemaVersion: 1, code, message, ...detail });
  }
};

// packages/chatobby-project-contracts/src/ids.ts
var OPAQUE_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,126}[A-Za-z0-9])?$/u;
function parseOpaqueId(value, label) {
  if (typeof value !== "string" || !OPAQUE_ID_PATTERN.test(value) || value === "." || value === "..") {
    throw new ProjectContractError(
      "PROJECT_CONTRACT_INVALID",
      `${label} must be a non-empty opaque identifier without path syntax.`,
      { retryable: false, field: label }
    );
  }
  return value;
}
var parseVaultId = (value) => parseOpaqueId(value, "vaultId");
var parseProjectId = (value) => parseOpaqueId(value, "projectId");
var parseRootId = (value) => parseOpaqueId(value, "rootId");
var parseDirectoryId = (value) => parseOpaqueId(value, "directoryId");
var parseBindingId = (value) => parseOpaqueId(value, "bindingId");
var parseSessionId = (value) => parseOpaqueId(value, "sessionId");
var parseProjectReceiptId = (value) => parseOpaqueId(value, "receiptId");
var parseProjectCommandId = (value) => parseOpaqueId(value, "commandId");
var parseProjectEventId = (value) => parseOpaqueId(value, "eventId");
var parseDeviceId = (value) => parseOpaqueId(value, "deviceId");
var parseDirectoryCandidateRef = (value) => parseOpaqueId(value, "directoryCandidateRef");
var parseDirectoryObservationId = (value) => parseOpaqueId(value, "observationId");
var parseRootOperationId = (value) => parseOpaqueId(value, "operationId");
var parseSessionPreflightReceiptId = (value) => parseOpaqueId(value, "sessionPreflightReceiptId");

// packages/chatobby-project-contracts/src/models.ts
var PROJECT_SCHEMA_VERSION = 1;
var DIRECTORY_BINDING_HISTORY_LIMIT = 32;

// packages/chatobby-project-contracts/src/operations.ts
function projectProjectSummary(record, brief) {
  const primaryRoot = record.roots.find((root) => root.rootId === record.primaryRootId);
  return Object.freeze({
    schemaVersion: 1,
    projectId: record.projectId,
    vaultId: record.vaultId,
    revision: record.revision,
    name: record.name,
    ...record.description === void 0 ? {} : { description: record.description },
    lifecycle: record.lifecycle,
    creationKind: record.creationKind,
    ...record.primaryRootId === void 0 ? {} : { primaryRootId: record.primaryRootId },
    ...primaryRoot === void 0 ? {} : { primaryRootLabel: primaryRoot.label },
    rootCount: record.roots.length,
    ...brief === void 0 ? {} : { briefRevision: brief.revision, briefUpdatedAt: brief.updatedAt },
    updatedAt: record.updatedAt
  });
}
function projectProjectDetail(project, bindings, sessionBindings, brief) {
  return Object.freeze({
    schemaVersion: 1,
    project,
    bindings: Object.freeze(
      [...bindings].filter((binding) => project.roots.some((root) => root.directoryId === binding.directoryId)).sort((left, right) => left.bindingId.localeCompare(right.bindingId)).map(projectDirectoryBinding)
    ),
    activeSessionIds: Object.freeze(
      [...sessionBindings].filter((binding) => binding.kind === "project" && binding.projectId === project.projectId).map((binding) => binding.sessionId).sort((left, right) => left.localeCompare(right))
    ),
    ...brief === void 0 ? {} : { brief }
  });
}
function projectDirectoryBinding(binding) {
  return Object.freeze({
    schemaVersion: 1,
    revision: binding.revision,
    bindingId: binding.bindingId,
    directoryId: binding.directoryId,
    status: binding.status,
    recoveryMode: binding.recoveryMode,
    historyCount: binding.history.length,
    lastValidatedAt: binding.lastValidatedAt
  });
}
function projectProjectStructure(project, options = {}) {
  const maximumRoots = Math.max(1, Math.min(32, Math.trunc(options.maximumRoots ?? 8)));
  const roots = [...project.roots].sort(
    (left, right) => left.rootId === project.primaryRootId ? -1 : right.rootId === project.primaryRootId ? 1 : left.rootId.localeCompare(right.rootId)
  ).slice(0, maximumRoots).map(
    (root) => Object.freeze({
      rootId: root.rootId,
      label: root.label,
      primary: root.rootId === project.primaryRootId,
      locationKind: root.location.kind
    })
  );
  return Object.freeze({
    schemaVersion: 1,
    projectId: project.projectId,
    name: project.name,
    lifecycle: project.lifecycle,
    ...project.primaryRootId === void 0 ? {} : { primaryRootId: project.primaryRootId },
    roots: Object.freeze(roots),
    rootCount: project.roots.length,
    hasMoreRoots: project.roots.length > roots.length,
    hasBrief: options.brief !== void 0
  });
}

// packages/chatobby-project-contracts/src/validation.ts
function invalid(message, field, code = "PROJECT_CONTRACT_INVALID") {
  throw new ProjectContractError(code, message, { retryable: false, ...field === void 0 ? {} : { field } });
}
function expectRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(`${label} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(`${label} must be a plain object.`);
  return value;
}
function expectExactKeys(record, required, optional = [], label = "record") {
  const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) invalid(`${label} contains unsupported field ${key}.`, key);
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) invalid(`${label} is missing required field ${key}.`, key);
  }
}
function expectSchemaVersion(record) {
  if (record.schemaVersion !== 1) {
    invalid(
      `Unsupported Project schema version: ${String(record.schemaVersion)}.`,
      "schemaVersion",
      "PROJECT_UNKNOWN_SCHEMA_VERSION"
    );
  }
  return 1;
}
function expectString(value, field, options = {}) {
  if (typeof value !== "string" || !options.allowEmpty && value.trim().length === 0) {
    invalid(`${field} must be ${options.allowEmpty ? "a string" : "a non-empty string"}.`, field);
  }
  if (value.includes("\0")) invalid(`${field} must not contain a null byte.`, field, "PROJECT_PATH_UNSAFE");
  if (value.length > (options.maximum ?? 4096)) invalid(`${field} is too long.`, field);
  return value;
}
function expectLiteral(value, choices, field) {
  if (typeof value !== "string" || !choices.includes(value)) {
    invalid(`${field} must be one of: ${choices.join(", ")}.`, field);
  }
  return value;
}
function expectInteger(value, field, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    invalid(`${field} must be a safe integer greater than or equal to ${minimum}.`, field);
  }
  return value;
}
function expectBoolean(value, field) {
  if (typeof value !== "boolean") invalid(`${field} must be a boolean.`, field);
  return value;
}
function expectArray(value, field) {
  if (!Array.isArray(value)) invalid(`${field} must be an array.`, field);
  return value;
}
function expectIsoTimestamp(value, field) {
  const timestamp = expectString(value, field, { maximum: 40 });
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) {
    invalid(`${field} must be a canonical ISO-8601 UTC timestamp.`, field);
  }
  return timestamp;
}
function expectSha256(value, field) {
  const hash = expectString(value, field, { maximum: 64 });
  if (!/^[a-f0-9]{64}$/u.test(hash)) invalid(`${field} must be a lowercase SHA-256 digest.`, field);
  return hash;
}
function expectUnique(values, field, code) {
  if (new Set(values).size !== values.length) invalid(`${field} must not contain duplicates.`, field, code);
}
function isAbsolutePath(value) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value) || /^(?:\\\\|\/\/)[^\\/]/u.test(value);
}
function pathHasTraversal(value) {
  return value.split(/[\\/]+/u).some((segment) => segment === "." || segment === "..");
}
function parseVaultRelativePath(value) {
  const path = expectString(value, "relativePath", { allowEmpty: true });
  if (isAbsolutePath(path) || path.includes("\\") || path.startsWith("/") || path.endsWith("/") || path.includes("//") || pathHasTraversal(path)) {
    invalid(
      "relativePath must be normalized, vault-relative, and traversal-free.",
      "relativePath",
      "PROJECT_PATH_UNSAFE"
    );
  }
  return path;
}
function parseCanonicalAbsolutePath(value) {
  const path = expectString(value, "canonicalAbsolutePath");
  if (!isAbsolutePath(path) || pathHasTraversal(path)) {
    invalid(
      "canonicalAbsolutePath must be an absolute Windows, UNC, macOS, or Linux path without traversal segments.",
      "canonicalAbsolutePath",
      "PROJECT_PATH_UNSAFE"
    );
  }
  return path;
}
function parseOptionalOpaqueReference(value, field) {
  try {
    return parseOpaqueId(value, field);
  } catch (error) {
    invalid(error instanceof Error ? error.message : `${field} is invalid.`, field);
  }
}
function parseProjectDefaultsV1(value) {
  const record = expectRecord(value, "Project defaults");
  expectExactKeys(
    record,
    [],
    ["permissionProfileId", "agentRoleId", "mcpConnectionSetId", "eventSetId", "workflowSetId", "gitPolicy"],
    "Project defaults"
  );
  return Object.freeze({
    ...record.permissionProfileId === void 0 ? {} : { permissionProfileId: parseOptionalOpaqueReference(record.permissionProfileId, "permissionProfileId") },
    ...record.agentRoleId === void 0 ? {} : { agentRoleId: parseOptionalOpaqueReference(record.agentRoleId, "agentRoleId") },
    ...record.mcpConnectionSetId === void 0 ? {} : { mcpConnectionSetId: parseOptionalOpaqueReference(record.mcpConnectionSetId, "mcpConnectionSetId") },
    ...record.eventSetId === void 0 ? {} : { eventSetId: parseOptionalOpaqueReference(record.eventSetId, "eventSetId") },
    ...record.workflowSetId === void 0 ? {} : { workflowSetId: parseOptionalOpaqueReference(record.workflowSetId, "workflowSetId") },
    ...record.gitPolicy === void 0 ? {} : { gitPolicy: expectLiteral(record.gitPolicy, ["off", "detect", "offer-initialize"], "gitPolicy") }
  });
}
function parseProjectRootLocationV1(value) {
  const record = expectRecord(value, "Project root location");
  if (record.kind === "vault-relative") {
    expectExactKeys(record, ["kind", "relativePath"], [], "Vault-relative location");
    return Object.freeze({
      kind: "vault-relative",
      relativePath: parseVaultRelativePath(record.relativePath)
    });
  }
  if (record.kind === "external") {
    expectExactKeys(record, ["kind"], [], "External location");
    return Object.freeze({ kind: "external" });
  }
  invalid("Project root location kind must be vault-relative or external.", "kind");
}
function parseProjectRootV1(value) {
  const record = expectRecord(value, "Project root");
  expectExactKeys(
    record,
    ["rootId", "directoryId", "label", "location", "markerPolicy", "directoryReuse", "createdAt"],
    [],
    "Project root"
  );
  return Object.freeze({
    rootId: parseRootId(record.rootId),
    directoryId: parseDirectoryId(record.directoryId),
    label: expectString(record.label, "label", { maximum: 200 }),
    location: parseProjectRootLocationV1(record.location),
    markerPolicy: expectLiteral(record.markerPolicy, ["required", "optional", "disabled"], "markerPolicy"),
    directoryReuse: expectLiteral(record.directoryReuse, ["canonical", "none"], "directoryReuse"),
    createdAt: expectIsoTimestamp(record.createdAt, "createdAt")
  });
}
function parseVaultIdentityV1(value) {
  const record = expectRecord(value, "Vault identity");
  expectSchemaVersion(record);
  expectExactKeys(record, ["schemaVersion", "vaultId", "createdAt"], [], "Vault identity");
  return Object.freeze({
    schemaVersion: 1,
    vaultId: parseVaultId(record.vaultId),
    createdAt: expectIsoTimestamp(record.createdAt, "createdAt")
  });
}
function parseDeviceIdentityV1(value) {
  const record = expectRecord(value, "Device identity");
  expectSchemaVersion(record);
  expectExactKeys(record, ["schemaVersion", "deviceId", "createdAt"], [], "Device identity");
  return Object.freeze({
    schemaVersion: 1,
    deviceId: parseDeviceId(record.deviceId),
    createdAt: expectIsoTimestamp(record.createdAt, "createdAt")
  });
}
function parseProjectRecordV1(value) {
  const record = expectRecord(value, "Project record");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "projectId",
      "vaultId",
      "revision",
      "name",
      "lifecycle",
      "creationKind",
      "roots",
      "defaults",
      "createdAt",
      "updatedAt"
    ],
    ["description", "primaryRootId"],
    "Project record"
  );
  const roots = expectArray(record.roots, "roots").map(parseProjectRootV1);
  expectUnique(
    roots.map((root) => root.rootId),
    "roots.rootId",
    "PROJECT_DUPLICATE_ROOT"
  );
  expectUnique(
    roots.map((root) => root.directoryId),
    "roots.directoryId",
    "PROJECT_DUPLICATE_ROOT"
  );
  const primaryRootId = record.primaryRootId === void 0 ? void 0 : parseRootId(record.primaryRootId);
  if (roots.length === 0 && primaryRootId !== void 0) {
    invalid("A folderless Project cannot declare a primary root.", "primaryRootId", "PROJECT_PRIMARY_ROOT_INVALID");
  }
  if (roots.length > 0 && primaryRootId === void 0) {
    invalid("A Project with folders must declare a primary root.", "primaryRootId", "PROJECT_PRIMARY_ROOT_INVALID");
  }
  if (primaryRootId !== void 0 && roots.filter((root) => root.rootId === primaryRootId).length !== 1) {
    invalid("primaryRootId must identify exactly one Project root.", "primaryRootId", "PROJECT_PRIMARY_ROOT_INVALID");
  }
  if (roots.filter((root) => root.directoryReuse === "canonical").length > 1) {
    invalid(
      "A Project may contain at most one canonical directory-reuse root.",
      "roots.directoryReuse",
      "PROJECT_CANONICAL_REUSE_CONFLICT"
    );
  }
  const createdAt = expectIsoTimestamp(record.createdAt, "createdAt");
  const updatedAt = expectIsoTimestamp(record.updatedAt, "updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) invalid("updatedAt cannot precede createdAt.", "updatedAt");
  return Object.freeze({
    schemaVersion: 1,
    projectId: parseProjectId(record.projectId),
    vaultId: parseVaultId(record.vaultId),
    revision: expectInteger(record.revision, "revision"),
    name: expectString(record.name, "name", { maximum: 200 }),
    ...record.description === void 0 ? {} : { description: expectString(record.description, "description", { allowEmpty: true, maximum: 4e3 }) },
    lifecycle: expectLiteral(record.lifecycle, ["active", "archived"], "lifecycle"),
    creationKind: expectLiteral(record.creationKind, ["directory-session", "manual", "migration"], "creationKind"),
    ...primaryRootId === void 0 ? {} : { primaryRootId },
    roots: Object.freeze(roots),
    defaults: parseProjectDefaultsV1(record.defaults),
    createdAt,
    updatedAt
  });
}
function parseProjectBriefMetadataV1(value) {
  const record = expectRecord(value, "Project brief metadata");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    ["schemaVersion", "projectId", "vaultId", "revision", "contentSha256", "byteLength", "createdAt", "updatedAt"],
    [],
    "Project brief metadata"
  );
  const createdAt = expectIsoTimestamp(record.createdAt, "createdAt");
  const updatedAt = expectIsoTimestamp(record.updatedAt, "updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) invalid("updatedAt cannot precede createdAt.", "updatedAt");
  return Object.freeze({
    schemaVersion: 1,
    projectId: parseProjectId(record.projectId),
    vaultId: parseVaultId(record.vaultId),
    revision: expectInteger(record.revision, "revision"),
    contentSha256: expectSha256(record.contentSha256, "contentSha256"),
    byteLength: expectInteger(record.byteLength, "byteLength", 0),
    createdAt,
    updatedAt
  });
}
function parseProjectBriefV1(value) {
  const record = expectRecord(value, "Project brief");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "projectId",
      "vaultId",
      "revision",
      "contentSha256",
      "byteLength",
      "createdAt",
      "updatedAt",
      "markdown"
    ],
    [],
    "Project brief"
  );
  const metadata = parseProjectBriefMetadataV1({
    schemaVersion: record.schemaVersion,
    projectId: record.projectId,
    vaultId: record.vaultId,
    revision: record.revision,
    contentSha256: record.contentSha256,
    byteLength: record.byteLength,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
  return Object.freeze({
    ...metadata,
    markdown: expectString(record.markdown, "markdown", { allowEmpty: true, maximum: 131072 })
  });
}
function parseDirectoryBindingHistoryEntryV1(value) {
  const record = expectRecord(value, "Directory binding history entry");
  expectExactKeys(record, ["canonicalAbsolutePath", "recordedAt", "reason"], [], "Directory binding history entry");
  return Object.freeze({
    canonicalAbsolutePath: parseCanonicalAbsolutePath(record.canonicalAbsolutePath),
    recordedAt: expectIsoTimestamp(record.recordedAt, "recordedAt"),
    reason: expectLiteral(
      record.reason,
      ["initial", "rename", "move", "relink", "recovery", "replacement"],
      "reason"
    )
  });
}
function parseDirectoryDeviceBindingV1(value) {
  const record = expectRecord(value, "Directory device binding");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "revision",
      "bindingId",
      "vaultId",
      "directoryId",
      "deviceId",
      "canonicalAbsolutePath",
      "status",
      "recoveryMode",
      "history",
      "lastValidatedAt"
    ],
    [],
    "Directory device binding"
  );
  const history = expectArray(record.history, "history").map(parseDirectoryBindingHistoryEntryV1);
  if (history.length > DIRECTORY_BINDING_HISTORY_LIMIT) {
    invalid(
      `Directory binding history exceeds the bounded limit of ${DIRECTORY_BINDING_HISTORY_LIMIT} entries.`,
      "history"
    );
  }
  for (let index = 1; index < history.length; index += 1) {
    if (Date.parse(history[index].recordedAt) < Date.parse(history[index - 1].recordedAt)) {
      invalid("Directory binding history must be chronological.", "history.recordedAt");
    }
  }
  const canonicalAbsolutePath = parseCanonicalAbsolutePath(record.canonicalAbsolutePath);
  if (history.at(-1)?.canonicalAbsolutePath === canonicalAbsolutePath) {
    invalid("Binding history must contain previous paths, not duplicate the current path.", "history");
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: expectInteger(record.revision, "revision"),
    bindingId: parseBindingId(record.bindingId),
    vaultId: parseVaultId(record.vaultId),
    directoryId: parseDirectoryId(record.directoryId),
    deviceId: parseDeviceId(record.deviceId),
    canonicalAbsolutePath,
    status: expectLiteral(record.status, ["available", "missing", "conflict", "relink-required"], "status"),
    recoveryMode: expectLiteral(record.recoveryMode, ["marker", "device-binding-only"], "recoveryMode"),
    history: Object.freeze(history),
    lastValidatedAt: expectIsoTimestamp(record.lastValidatedAt, "lastValidatedAt")
  });
}
function parseSessionWorkspaceBindingV1(value) {
  const record = expectRecord(value, "Session workspace binding");
  expectSchemaVersion(record);
  if (record.kind === "vault") {
    expectExactKeys(
      record,
      ["schemaVersion", "revision", "sessionId", "kind", "vaultId"],
      [],
      "Vault session workspace binding"
    );
    return Object.freeze({
      schemaVersion: 1,
      revision: expectInteger(record.revision, "revision"),
      sessionId: parseSessionId(record.sessionId),
      kind: "vault",
      vaultId: parseVaultId(record.vaultId)
    });
  }
  if (record.kind === "project") {
    expectExactKeys(
      record,
      ["schemaVersion", "revision", "sessionId", "kind", "vaultId", "projectId", "sessionAttachedRootIds"],
      ["activeRootId"],
      "Project session workspace binding"
    );
    const attached = expectArray(record.sessionAttachedRootIds, "sessionAttachedRootIds").map(parseRootId);
    expectUnique(attached, "sessionAttachedRootIds", "PROJECT_DUPLICATE_ROOT");
    const activeRootId = record.activeRootId === void 0 ? void 0 : parseRootId(record.activeRootId);
    if (activeRootId !== void 0 && attached.includes(activeRootId)) {
      invalid(
        "The active root must not also appear in sessionAttachedRootIds.",
        "sessionAttachedRootIds",
        "PROJECT_DUPLICATE_ROOT"
      );
    }
    return Object.freeze({
      schemaVersion: 1,
      revision: expectInteger(record.revision, "revision"),
      sessionId: parseSessionId(record.sessionId),
      kind: "project",
      vaultId: parseVaultId(record.vaultId),
      projectId: parseProjectId(record.projectId),
      ...activeRootId === void 0 ? {} : { activeRootId },
      sessionAttachedRootIds: Object.freeze(attached)
    });
  }
  invalid("Session workspace binding kind must be vault or project.", "kind");
}
function parseSessionWorkspaceBindingDocumentV1(value) {
  const record = expectRecord(value, "Session workspace binding document");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    ["schemaVersion", "vaultId", "revision", "updatedAt", "bindings"],
    [],
    "Session workspace binding document"
  );
  const vaultId = parseVaultId(record.vaultId);
  const bindings = expectArray(record.bindings, "bindings").map(parseSessionWorkspaceBindingV1);
  expectUnique(
    bindings.map((binding) => binding.sessionId),
    "bindings.sessionId",
    "PROJECT_REFERENCE_MISSING"
  );
  for (const binding of bindings) {
    if (binding.vaultId !== vaultId) {
      invalid("Session workspace binding belongs to another vault.", "bindings", "PROJECT_REFERENCE_MISSING");
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    vaultId,
    revision: expectInteger(record.revision, "revision", 0),
    updatedAt: expectIsoTimestamp(record.updatedAt, "updatedAt"),
    bindings: Object.freeze([...bindings].sort((left, right) => left.sessionId.localeCompare(right.sessionId)))
  });
}
function parseDirectoryMarkerV1(value) {
  const record = expectRecord(value, "Directory marker");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    ["schemaVersion", "directoryId", "createdAt"],
    ["createdByVaultId", "createdByOperationId"],
    "Directory marker"
  );
  return Object.freeze({
    schemaVersion: 1,
    directoryId: parseDirectoryId(record.directoryId),
    createdAt: expectIsoTimestamp(record.createdAt, "createdAt"),
    ...record.createdByVaultId === void 0 ? {} : { createdByVaultId: parseVaultId(record.createdByVaultId) },
    ...record.createdByOperationId === void 0 ? {} : { createdByOperationId: parseRootOperationId(record.createdByOperationId) }
  });
}
function parseDirectoryMarkerObservationV1(value) {
  const record = expectRecord(value, "Directory marker observation");
  expectExactKeys(
    record,
    ["observationId", "directoryId", "candidateRef", "scope", "source", "markerSha256", "observedAt"],
    ["vaultRelativePath"],
    "Directory marker observation"
  );
  const scope = expectLiteral(record.scope, ["vault", "external"], "scope");
  if (scope === "vault" && record.vaultRelativePath === void 0) {
    invalid("Vault marker observations require a vault-relative path.", "vaultRelativePath");
  }
  if (scope === "external" && record.vaultRelativePath !== void 0) {
    invalid("External marker observations must not contain a vault-relative path.", "vaultRelativePath");
  }
  const source = expectLiteral(
    record.source,
    ["vault-index", "bounded-search", "live-event", "explicit-relink"],
    "source"
  );
  if ((source === "vault-index" || source === "live-event") && scope !== "vault") {
    invalid("Vault-index and live-event observations must be vault scoped.", "source");
  }
  return Object.freeze({
    observationId: parseDirectoryObservationId(record.observationId),
    directoryId: parseDirectoryId(record.directoryId),
    candidateRef: parseDirectoryCandidateRef(record.candidateRef),
    scope,
    source,
    ...record.vaultRelativePath === void 0 ? {} : { vaultRelativePath: parseVaultRelativePath(record.vaultRelativePath) },
    markerSha256: expectSha256(record.markerSha256, "markerSha256"),
    observedAt: expectIsoTimestamp(record.observedAt, "observedAt")
  });
}
function parseDirectoryMarkerIndexCoverageV1(value) {
  const record = expectRecord(value, "Directory marker-index coverage");
  expectExactKeys(
    record,
    ["kind", "scope", "capturedAt", "visitedDirectories", "maximumDirectories", "hasMore", "cancelled", "timedOut"],
    [],
    "Directory marker-index coverage"
  );
  const kind = expectLiteral(record.kind, ["complete", "bounded", "partial"], "kind");
  const visitedDirectories = expectInteger(record.visitedDirectories, "visitedDirectories", 0);
  const maximumDirectories = expectInteger(record.maximumDirectories, "maximumDirectories", 1);
  const hasMore = expectBoolean(record.hasMore, "hasMore");
  const cancelled = expectBoolean(record.cancelled, "cancelled");
  const timedOut = expectBoolean(record.timedOut, "timedOut");
  if (visitedDirectories > maximumDirectories) {
    invalid("Marker-index coverage cannot exceed its declared directory bound.", "visitedDirectories");
  }
  if (cancelled && timedOut) invalid("Marker-index coverage cannot be both cancelled and timed out.", "cancelled");
  if (kind === "complete" && (hasMore || cancelled || timedOut)) {
    invalid("Complete marker-index coverage cannot be truncated, cancelled, or timed out.", "kind");
  }
  if ((cancelled || timedOut) && kind !== "partial") {
    invalid("Cancelled or timed-out coverage must be marked partial.", "kind");
  }
  if (kind === "partial" && !hasMore) invalid("Partial coverage must state that more material remains.", "hasMore");
  return Object.freeze({
    kind,
    scope: expectLiteral(record.scope, ["vault", "external"], "scope"),
    capturedAt: expectIsoTimestamp(record.capturedAt, "capturedAt"),
    visitedDirectories,
    maximumDirectories,
    hasMore,
    cancelled,
    timedOut
  });
}
function parseDirectoryMarkerIndexV1(value) {
  const record = expectRecord(value, "Directory marker index");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    ["schemaVersion", "revision", "vaultId", "deviceId", "coverage", "observations"],
    [],
    "Directory marker index"
  );
  const coverage = expectArray(record.coverage, "coverage").map(parseDirectoryMarkerIndexCoverageV1);
  if (coverage.length === 0) invalid("A marker index requires explicit coverage.", "coverage");
  expectUnique(
    coverage.map((entry) => entry.scope),
    "coverage.scope",
    "PROJECT_CONTRACT_INVALID"
  );
  const observations = expectArray(record.observations, "observations").map(parseDirectoryMarkerObservationV1);
  const coveredScopes = new Set(coverage.map((entry) => entry.scope));
  if (observations.some((observation) => !coveredScopes.has(observation.scope))) {
    invalid("Every marker observation must have a matching coverage scope.", "observations.scope");
  }
  expectUnique(
    observations.map((entry) => entry.observationId),
    "observations.observationId",
    "PROJECT_CONTRACT_INVALID"
  );
  expectUnique(
    observations.map((entry) => entry.candidateRef),
    "observations.candidateRef",
    "PROJECT_DIRECTORY_MARKER_CONFLICT"
  );
  return Object.freeze({
    schemaVersion: 1,
    revision: expectInteger(record.revision, "revision", 0),
    vaultId: parseVaultId(record.vaultId),
    deviceId: parseDeviceId(record.deviceId),
    coverage: Object.freeze(coverage),
    observations: Object.freeze(observations)
  });
}
function parseRootRecoveryResultV1(value) {
  const record = expectRecord(value, "Root recovery result");
  const projectId = parseProjectId(record.projectId);
  const rootId = parseRootId(record.rootId);
  if (record.status === "available") {
    expectExactKeys(record, ["status", "projectId", "rootId", "directoryId", "bindingId"]);
    return Object.freeze({
      status: "available",
      projectId,
      rootId,
      directoryId: parseDirectoryId(record.directoryId),
      bindingId: parseBindingId(record.bindingId)
    });
  }
  if (record.status === "missing") {
    expectExactKeys(record, ["status", "projectId", "rootId", "directoryId"]);
    return Object.freeze({ status: "missing", projectId, rootId, directoryId: parseDirectoryId(record.directoryId) });
  }
  if (record.status === "conflict") {
    expectExactKeys(record, ["status", "projectId", "rootId", "directoryId", "candidates"]);
    const candidates = expectArray(record.candidates, "candidates").map(parseDirectoryCandidateRef);
    if (candidates.length < 2) invalid("A conflict requires at least two candidates.", "candidates");
    expectUnique(candidates, "candidates", "PROJECT_DIRECTORY_MARKER_CONFLICT");
    return Object.freeze({
      status: "conflict",
      projectId,
      rootId,
      directoryId: parseDirectoryId(record.directoryId),
      candidates: Object.freeze(candidates)
    });
  }
  if (record.status === "relink-required") {
    expectExactKeys(record, ["status", "projectId", "rootId", "expectedRootLabel", "recoveryMode"]);
    return Object.freeze({
      status: "relink-required",
      projectId,
      rootId,
      expectedRootLabel: expectString(record.expectedRootLabel, "expectedRootLabel", { maximum: 200 }),
      recoveryMode: expectLiteral(record.recoveryMode, ["marker", "device-binding-only"], "recoveryMode")
    });
  }
  if (record.status === "cancelled" || record.status === "timed-out") {
    expectExactKeys(record, ["status", "projectId", "rootId", "previousStatus"]);
    return Object.freeze({
      status: record.status,
      projectId,
      rootId,
      previousStatus: expectLiteral(
        record.previousStatus,
        ["available", "missing", "conflict", "relink-required"],
        "previousStatus"
      )
    });
  }
  invalid("Unknown root recovery status.", "status");
}
var ROOT_MUTATION_KINDS = [
  "create",
  "register",
  "add",
  "relabel",
  "set-primary",
  "remove",
  "relink",
  "repair",
  "assign-new-identity"
];
function parseRootMutationKind(value) {
  return expectLiteral(value, ROOT_MUTATION_KINDS, "operation");
}
function parseRootOperationArtifactV1(value) {
  const record = expectRecord(value, "Root operation artifact");
  expectExactKeys(record, ["resource", "identity"], ["beforeSha256", "intendedSha256"], "Root operation artifact");
  if (record.beforeSha256 === void 0 && record.intendedSha256 === void 0) {
    invalid("A root operation artifact requires a before or intended hash.", "beforeSha256");
  }
  return Object.freeze({
    resource: expectLiteral(
      record.resource,
      ["project-record", "directory", "directory-marker", "device-binding", "marker-index", "recovery-plan"],
      "resource"
    ),
    identity: parseOpaqueId(record.identity, "identity"),
    ...record.beforeSha256 === void 0 ? {} : { beforeSha256: expectSha256(record.beforeSha256, "beforeSha256") },
    ...record.intendedSha256 === void 0 ? {} : { intendedSha256: expectSha256(record.intendedSha256, "intendedSha256") }
  });
}
function parseRootOperationJournalV1(value) {
  const record = expectRecord(value, "Root operation journal");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "operationId",
      "commandId",
      "commandSha256",
      "operation",
      "stage",
      "vaultId",
      "projectId",
      "rootIds",
      "directoryIds",
      "expectedProjectRevision",
      "artifacts",
      "preparedAt",
      "updatedAt"
    ],
    [],
    "Root operation journal"
  );
  const rootIds = expectArray(record.rootIds, "rootIds").map(parseRootId);
  const directoryIds = expectArray(record.directoryIds, "directoryIds").map(parseDirectoryId);
  if (rootIds.length === 0) invalid("A root operation journal requires at least one root.", "rootIds");
  expectUnique(rootIds, "rootIds", "PROJECT_DUPLICATE_ROOT");
  expectUnique(directoryIds, "directoryIds", "PROJECT_DUPLICATE_ROOT");
  const artifacts = expectArray(record.artifacts, "artifacts").map(parseRootOperationArtifactV1);
  if (artifacts.length === 0) invalid("A root operation journal requires at least one tracked artifact.", "artifacts");
  expectUnique(
    artifacts.map((artifact) => `${artifact.resource}:${artifact.identity}`),
    "artifacts",
    "PROJECT_CONTRACT_INVALID"
  );
  const preparedAt = expectIsoTimestamp(record.preparedAt, "preparedAt");
  const updatedAt = expectIsoTimestamp(record.updatedAt, "updatedAt");
  if (Date.parse(updatedAt) < Date.parse(preparedAt))
    invalid("Journal update cannot precede preparation.", "updatedAt");
  return Object.freeze({
    schemaVersion: 1,
    operationId: parseRootOperationId(record.operationId),
    commandId: parseProjectCommandId(record.commandId),
    commandSha256: expectSha256(record.commandSha256, "commandSha256"),
    operation: parseRootMutationKind(record.operation),
    stage: expectLiteral(record.stage, ["prepared", "committing", "compensating", "committed", "failed"], "stage"),
    vaultId: parseVaultId(record.vaultId),
    projectId: parseProjectId(record.projectId),
    rootIds: Object.freeze(rootIds),
    directoryIds: Object.freeze(directoryIds),
    expectedProjectRevision: expectInteger(record.expectedProjectRevision, "expectedProjectRevision", 0),
    artifacts: Object.freeze(artifacts),
    preparedAt,
    updatedAt
  });
}
function parseProjectErrorV1(value) {
  const record = expectRecord(value, "Project error");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    ["schemaVersion", "code", "message", "retryable"],
    ["field", "expectedRevision", "actualRevision"],
    "Project error"
  );
  return Object.freeze({
    schemaVersion: 1,
    code: expectLiteral(record.code, PROJECT_ERROR_CODES, "code"),
    message: expectString(record.message, "message"),
    retryable: expectBoolean(record.retryable, "retryable"),
    ...record.field === void 0 ? {} : { field: expectString(record.field, "field") },
    ...record.expectedRevision === void 0 ? {} : { expectedRevision: expectInteger(record.expectedRevision, "expectedRevision", 0) },
    ...record.actualRevision === void 0 ? {} : { actualRevision: expectInteger(record.actualRevision, "actualRevision", 0) }
  });
}
function parseProjectCreationRootIntentV1(value) {
  const record = expectRecord(value, "Project creation root intent");
  if (record.kind === "selected-root") {
    expectExactKeys(
      record,
      ["kind", "directoryCandidateRef", "label", "markerPolicy", "directoryReuse"],
      [],
      "Selected-root Project creation intent"
    );
    return Object.freeze({
      kind: "selected-root",
      directoryCandidateRef: parseDirectoryCandidateRef(record.directoryCandidateRef),
      label: expectString(record.label, "label", { maximum: 200 }),
      markerPolicy: expectLiteral(record.markerPolicy, ["required", "optional", "disabled"], "markerPolicy"),
      directoryReuse: expectLiteral(record.directoryReuse, ["canonical", "none"], "directoryReuse")
    });
  }
  if (record.kind === "vault-folder") {
    expectExactKeys(record, ["kind", "label", "directoryReuse"], [], "Vault-folder Project creation intent");
    return Object.freeze({
      kind: "vault-folder",
      label: expectString(record.label, "label", { maximum: 200 }),
      directoryReuse: expectLiteral(record.directoryReuse, ["canonical", "none"], "directoryReuse")
    });
  }
  invalid("Project creation root intent kind must be selected-root or vault-folder.", "root.kind");
}
function parseProjectCommandV1(value) {
  const record = expectRecord(value, "Project command");
  expectSchemaVersion(record);
  const base = {
    schemaVersion: 1,
    commandId: parseProjectCommandId(record.commandId),
    issuedAt: expectIsoTimestamp(record.issuedAt, "issuedAt")
  };
  if (record.type === "project.create.atomic") {
    expectExactKeys(
      record,
      ["schemaVersion", "commandId", "issuedAt", "type", "name", "creationKind", "defaults", "root"],
      ["description"],
      "Atomic Project creation command"
    );
    return Object.freeze({
      ...base,
      type: "project.create.atomic",
      name: expectString(record.name, "name", { maximum: 200 }),
      ...record.description === void 0 ? {} : { description: expectString(record.description, "description", { allowEmpty: true, maximum: 4e3 }) },
      creationKind: expectLiteral(record.creationKind, ["directory-session", "manual", "migration"], "creationKind"),
      defaults: parseProjectDefaultsV1(record.defaults),
      root: parseProjectCreationRootIntentV1(record.root)
    });
  }
  if (record.type === "project.replace") {
    expectExactKeys(
      record,
      ["schemaVersion", "commandId", "issuedAt", "type", "expectedRevision", "record"],
      [],
      "Project replace command"
    );
    const expectedRevision = expectInteger(record.expectedRevision, "expectedRevision");
    const project = parseProjectRecordV1(record.record);
    if (project.revision !== expectedRevision + 1)
      invalid("Replacement Project revision must be expectedRevision + 1.", "record.revision");
    return Object.freeze({ ...base, type: "project.replace", expectedRevision, record: project });
  }
  if (record.type === "project.archive" || record.type === "project.restore") {
    expectExactKeys(
      record,
      ["schemaVersion", "commandId", "issuedAt", "type", "projectId", "expectedRevision"],
      [],
      "Project lifecycle command"
    );
    return Object.freeze({
      ...base,
      type: record.type,
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision")
    });
  }
  if (record.type === "project.brief.replace") {
    expectExactKeys(
      record,
      ["schemaVersion", "commandId", "issuedAt", "type", "projectId", "expectedRevision", "markdown"],
      [],
      "Project brief replace command"
    );
    return Object.freeze({
      ...base,
      type: "project.brief.replace",
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision", 0),
      markdown: expectString(record.markdown, "markdown", { allowEmpty: true, maximum: 131072 })
    });
  }
  if (record.type === "project.brief.remove") {
    expectExactKeys(
      record,
      ["schemaVersion", "commandId", "issuedAt", "type", "projectId", "expectedRevision"],
      [],
      "Project brief remove command"
    );
    return Object.freeze({
      ...base,
      type: "project.brief.remove",
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision")
    });
  }
  if (record.type === "session-workspace.replace") {
    expectExactKeys(
      record,
      ["schemaVersion", "commandId", "issuedAt", "type", "expectedRevision", "binding"],
      [],
      "Session workspace replace command"
    );
    const expectedRevision = expectInteger(record.expectedRevision, "expectedRevision", 0);
    const binding = parseSessionWorkspaceBindingV1(record.binding);
    if (binding.revision !== expectedRevision + 1)
      invalid("Replacement session binding revision must be expectedRevision + 1.", "binding.revision");
    return Object.freeze({ ...base, type: "session-workspace.replace", expectedRevision, binding });
  }
  if (record.type === "session-workspace.remove") {
    expectExactKeys(
      record,
      ["schemaVersion", "commandId", "issuedAt", "type", "sessionId", "expectedRevision"],
      [],
      "Session workspace remove command"
    );
    return Object.freeze({
      ...base,
      type: "session-workspace.remove",
      sessionId: parseSessionId(record.sessionId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision", 1)
    });
  }
  if (record.type === "project.root.register") {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "commandId",
        "issuedAt",
        "type",
        "projectId",
        "expectedRevision",
        "rootId",
        "directoryCandidateRef"
      ],
      [],
      "Project root registration command"
    );
    return Object.freeze({
      ...base,
      type: "project.root.register",
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision"),
      rootId: parseRootId(record.rootId),
      directoryCandidateRef: parseDirectoryCandidateRef(record.directoryCandidateRef)
    });
  }
  if (record.type === "project.root.add") {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "commandId",
        "issuedAt",
        "type",
        "projectId",
        "expectedRevision",
        "label",
        "location",
        "markerPolicy",
        "directoryReuse",
        "directoryCandidateRef"
      ],
      [],
      "Project root add command"
    );
    return Object.freeze({
      ...base,
      type: "project.root.add",
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision"),
      label: expectString(record.label, "label", { maximum: 200 }),
      location: parseProjectRootLocationV1(record.location),
      markerPolicy: expectLiteral(record.markerPolicy, ["required", "optional", "disabled"], "markerPolicy"),
      directoryReuse: expectLiteral(record.directoryReuse, ["canonical", "none"], "directoryReuse"),
      directoryCandidateRef: parseDirectoryCandidateRef(record.directoryCandidateRef)
    });
  }
  if (record.type === "project.root.relabel") {
    expectExactKeys(
      record,
      ["schemaVersion", "commandId", "issuedAt", "type", "projectId", "expectedRevision", "rootId", "label"],
      [],
      "Project root relabel command"
    );
    return Object.freeze({
      ...base,
      type: "project.root.relabel",
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision"),
      rootId: parseRootId(record.rootId),
      label: expectString(record.label, "label", { maximum: 200 })
    });
  }
  if (record.type === "project.root.set-primary") {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "commandId",
        "issuedAt",
        "type",
        "projectId",
        "expectedRevision",
        "rootId",
        "sessionPreflightReceiptId"
      ],
      [],
      "Project primary-root command"
    );
    return Object.freeze({
      ...base,
      type: "project.root.set-primary",
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision"),
      rootId: parseRootId(record.rootId),
      sessionPreflightReceiptId: parseSessionPreflightReceiptId(record.sessionPreflightReceiptId)
    });
  }
  if (record.type === "project.root.remove") {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "commandId",
        "issuedAt",
        "type",
        "projectId",
        "expectedRevision",
        "rootId",
        "sessionPreflightReceiptId"
      ],
      ["replacementRootId"],
      "Project root remove command"
    );
    const rootId = parseRootId(record.rootId);
    const replacementRootId = record.replacementRootId === void 0 ? void 0 : parseRootId(record.replacementRootId);
    if (replacementRootId === rootId) invalid("A removed root cannot replace itself.", "replacementRootId");
    return Object.freeze({
      ...base,
      type: "project.root.remove",
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision"),
      rootId,
      ...replacementRootId === void 0 ? {} : { replacementRootId },
      sessionPreflightReceiptId: parseSessionPreflightReceiptId(record.sessionPreflightReceiptId)
    });
  }
  if (record.type === "project.root.relink" || record.type === "project.root.repair") {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "commandId",
        "issuedAt",
        "type",
        "projectId",
        "expectedRevision",
        "rootId",
        "directoryCandidateRef"
      ],
      [],
      "Project root recovery command"
    );
    return Object.freeze({
      ...base,
      type: record.type,
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision"),
      rootId: parseRootId(record.rootId),
      directoryCandidateRef: parseDirectoryCandidateRef(record.directoryCandidateRef)
    });
  }
  if (record.type === "project.root.assign-new-identity") {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "commandId",
        "issuedAt",
        "type",
        "projectId",
        "expectedRevision",
        "rootIds",
        "directoryCandidateRef"
      ],
      [],
      "Project root identity-assignment command"
    );
    const rootIds = expectArray(record.rootIds, "rootIds").map(parseRootId);
    if (rootIds.length !== 1) {
      invalid("Phase 2 identity assignment requires exactly one selected root.", "rootIds");
    }
    expectUnique(rootIds, "rootIds", "PROJECT_DUPLICATE_ROOT");
    return Object.freeze({
      ...base,
      type: "project.root.assign-new-identity",
      projectId: parseProjectId(record.projectId),
      expectedRevision: expectInteger(record.expectedRevision, "expectedRevision"),
      rootIds: Object.freeze(rootIds),
      directoryCandidateRef: parseDirectoryCandidateRef(record.directoryCandidateRef)
    });
  }
  invalid("Unknown Project command type.", "type");
}
function parseProjectEventV1(value) {
  const record = expectRecord(value, "Project event");
  expectSchemaVersion(record);
  const base = {
    schemaVersion: 1,
    eventId: parseProjectEventId(record.eventId),
    sequence: expectInteger(record.sequence, "sequence"),
    occurredAt: expectIsoTimestamp(record.occurredAt, "occurredAt")
  };
  if (record.type === "project.recorded") {
    expectExactKeys(
      record,
      ["schemaVersion", "eventId", "sequence", "occurredAt", "type", "record"],
      [],
      "Project recorded event"
    );
    return Object.freeze({ ...base, type: "project.recorded", record: parseProjectRecordV1(record.record) });
  }
  if (record.type === "project.brief.recorded") {
    expectExactKeys(
      record,
      ["schemaVersion", "eventId", "sequence", "occurredAt", "type", "brief"],
      [],
      "Project brief recorded event"
    );
    return Object.freeze({
      ...base,
      type: "project.brief.recorded",
      brief: parseProjectBriefMetadataV1(record.brief)
    });
  }
  if (record.type === "project.brief.removed") {
    expectExactKeys(
      record,
      ["schemaVersion", "eventId", "sequence", "occurredAt", "type", "projectId", "previousRevision"],
      [],
      "Project brief removed event"
    );
    return Object.freeze({
      ...base,
      type: "project.brief.removed",
      projectId: parseProjectId(record.projectId),
      previousRevision: expectInteger(record.previousRevision, "previousRevision")
    });
  }
  if (record.type === "session-workspace.recorded") {
    expectExactKeys(
      record,
      ["schemaVersion", "eventId", "sequence", "occurredAt", "type", "binding"],
      [],
      "Session workspace event"
    );
    return Object.freeze({
      ...base,
      type: "session-workspace.recorded",
      binding: parseSessionWorkspaceBindingV1(record.binding)
    });
  }
  if (record.type === "session-workspace.removed") {
    expectExactKeys(
      record,
      ["schemaVersion", "eventId", "sequence", "occurredAt", "type", "sessionId", "previousRevision"],
      [],
      "Session workspace removed event"
    );
    return Object.freeze({
      ...base,
      type: "session-workspace.removed",
      sessionId: parseSessionId(record.sessionId),
      previousRevision: expectInteger(record.previousRevision, "previousRevision", 1)
    });
  }
  if (record.type === "directory-marker-index.recorded") {
    expectExactKeys(
      record,
      ["schemaVersion", "eventId", "sequence", "occurredAt", "type", "index"],
      [],
      "Directory marker-index event"
    );
    return Object.freeze({
      ...base,
      type: "directory-marker-index.recorded",
      index: parseDirectoryMarkerIndexV1(record.index)
    });
  }
  if (record.type === "project.root.recorded") {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "eventId",
        "sequence",
        "occurredAt",
        "type",
        "operation",
        "record",
        "affectedRootIds",
        "directoryIds"
      ],
      [],
      "Project root recorded event"
    );
    const project = parseProjectRecordV1(record.record);
    const affectedRootIds = expectArray(record.affectedRootIds, "affectedRootIds").map(parseRootId);
    const directoryIds = expectArray(record.directoryIds, "directoryIds").map(parseDirectoryId);
    if (affectedRootIds.length === 0) invalid("A root event requires at least one affected root.", "affectedRootIds");
    expectUnique(affectedRootIds, "affectedRootIds", "PROJECT_DUPLICATE_ROOT");
    expectUnique(directoryIds, "directoryIds", "PROJECT_DUPLICATE_ROOT");
    return Object.freeze({
      ...base,
      type: "project.root.recorded",
      operation: parseRootMutationKind(record.operation),
      record: project,
      affectedRootIds: Object.freeze(affectedRootIds),
      directoryIds: Object.freeze(directoryIds)
    });
  }
  if (record.type === "project.root.recovery-recorded") {
    expectExactKeys(
      record,
      ["schemaVersion", "eventId", "sequence", "occurredAt", "type", "result"],
      [],
      "Project root recovery event"
    );
    return Object.freeze({
      ...base,
      type: "project.root.recovery-recorded",
      result: parseRootRecoveryResultV1(record.result)
    });
  }
  invalid("Unknown Project event type.", "type");
}
function parseProjectSnapshotV1(value) {
  const record = expectRecord(value, "Project snapshot");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "sequence",
      "capturedAt",
      "vaultId",
      "projects",
      "briefs",
      "directoryBindings",
      "sessionWorkspaceBindings"
    ],
    [],
    "Project snapshot"
  );
  const vaultId = parseVaultId(record.vaultId);
  const projects = expectArray(record.projects, "projects").map(parseProjectRecordV1);
  const briefs = expectArray(record.briefs, "briefs").map(parseProjectBriefMetadataV1);
  const directoryBindings = expectArray(record.directoryBindings, "directoryBindings").map(
    parseDirectoryBindingProjectionV1
  );
  const sessionWorkspaceBindings = expectArray(record.sessionWorkspaceBindings, "sessionWorkspaceBindings").map(
    parseSessionWorkspaceBindingV1
  );
  expectUnique(
    projects.map((project) => project.projectId),
    "projects.projectId",
    "PROJECT_REFERENCE_MISSING"
  );
  expectUnique(
    briefs.map((brief) => brief.projectId),
    "briefs.projectId",
    "PROJECT_REFERENCE_MISSING"
  );
  expectUnique(
    directoryBindings.map((binding) => binding.bindingId),
    "directoryBindings.bindingId",
    "PROJECT_REFERENCE_MISSING"
  );
  expectUnique(
    directoryBindings.map((binding) => binding.directoryId),
    "directoryBindings.directoryId",
    "PROJECT_DIRECTORY_BINDING_CONFLICT"
  );
  expectUnique(
    sessionWorkspaceBindings.map((binding) => binding.sessionId),
    "sessionWorkspaceBindings.sessionId",
    "PROJECT_REFERENCE_MISSING"
  );
  const byProject = new Map(projects.map((project) => [project.projectId, project]));
  const canonicalDirectories = /* @__PURE__ */ new Map();
  for (const project of projects) {
    if (project.vaultId !== vaultId)
      invalid("Project snapshot contains a Project from another vault.", "projects", "PROJECT_REFERENCE_MISSING");
    if (project.lifecycle === "active") {
      for (const root of project.roots.filter((candidate) => candidate.directoryReuse === "canonical")) {
        const previous = canonicalDirectories.get(root.directoryId);
        if (previous !== void 0 && previous !== project.projectId) {
          invalid(
            "Only one active canonical Project may reuse a directory in a vault.",
            "projects",
            "PROJECT_CANONICAL_REUSE_CONFLICT"
          );
        }
        canonicalDirectories.set(root.directoryId, project.projectId);
      }
    }
  }
  const allRoots = projects.flatMap((project) => project.roots);
  for (const binding of directoryBindings) {
    const matchingRoots = allRoots.filter((root) => root.directoryId === binding.directoryId);
    if (matchingRoots.length === 0) {
      invalid(
        "Directory binding must reference a directory used by at least one Project root in the vault.",
        "directoryBindings",
        "PROJECT_REFERENCE_MISSING"
      );
    }
    if (binding.recoveryMode === "marker" && matchingRoots.every((root) => root.markerPolicy === "disabled")) {
      invalid(
        "A marker-backed directory binding cannot be supported only by marker-disabled roots.",
        "directoryBindings",
        "PROJECT_DIRECTORY_MARKER_INVALID"
      );
    }
  }
  for (const brief of briefs) {
    const project = byProject.get(brief.projectId);
    if (project === void 0 || brief.vaultId !== vaultId) {
      invalid(
        "Project brief must reference a matching Project in the snapshot.",
        "briefs",
        "PROJECT_REFERENCE_MISSING"
      );
    }
  }
  for (const binding of sessionWorkspaceBindings) {
    if (binding.vaultId !== vaultId)
      invalid("Session binding belongs to another vault.", "sessionWorkspaceBindings", "PROJECT_REFERENCE_MISSING");
    if (binding.kind === "project") {
      const project = byProject.get(binding.projectId);
      if (project === void 0)
        invalid("Session binding references a missing Project.", "projectId", "PROJECT_NOT_FOUND");
      const roots = new Set(project.roots.map((root) => root.rootId));
      if (binding.activeRootId !== void 0 && !roots.has(binding.activeRootId))
        invalid("Session active root is missing from its Project.", "activeRootId", "PROJECT_ROOT_NOT_FOUND");
      if (project.roots.length > 0 && binding.activeRootId === void 0)
        invalid(
          "A session in a Project with folders requires an active root.",
          "activeRootId",
          "PROJECT_ROOT_NOT_FOUND"
        );
      if (project.roots.length === 0 && binding.activeRootId !== void 0)
        invalid(
          "A folderless Project session cannot declare an active root.",
          "activeRootId",
          "PROJECT_ROOT_NOT_FOUND"
        );
      for (const rootId of binding.sessionAttachedRootIds) {
        if (!roots.has(rootId))
          invalid(
            "Session-attached root is missing from its Project.",
            "sessionAttachedRootIds",
            "PROJECT_ROOT_NOT_FOUND"
          );
      }
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    sequence: expectInteger(record.sequence, "sequence", 0),
    capturedAt: expectIsoTimestamp(record.capturedAt, "capturedAt"),
    vaultId,
    projects: Object.freeze(projects),
    briefs: Object.freeze(briefs),
    directoryBindings: Object.freeze(directoryBindings),
    sessionWorkspaceBindings: Object.freeze(sessionWorkspaceBindings)
  });
}
function parseDirectoryBindingProjectionV1(value) {
  const record = expectRecord(value, "Directory binding projection");
  expectSchemaVersion(record);
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "revision",
      "bindingId",
      "directoryId",
      "status",
      "recoveryMode",
      "historyCount",
      "lastValidatedAt"
    ],
    [],
    "Directory binding projection"
  );
  const historyCount = expectInteger(record.historyCount, "historyCount", 0);
  if (historyCount > DIRECTORY_BINDING_HISTORY_LIMIT) {
    invalid("Directory binding projection exceeds the bounded history limit.", "historyCount");
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: expectInteger(record.revision, "revision"),
    bindingId: parseBindingId(record.bindingId),
    directoryId: parseDirectoryId(record.directoryId),
    status: expectLiteral(record.status, ["available", "missing", "conflict", "relink-required"], "status"),
    recoveryMode: expectLiteral(record.recoveryMode, ["marker", "device-binding-only"], "recoveryMode"),
    historyCount,
    lastValidatedAt: expectIsoTimestamp(record.lastValidatedAt, "lastValidatedAt")
  });
}
function parseProjectReceiptV1(value) {
  const record = expectRecord(value, "Project receipt");
  expectSchemaVersion(record);
  if (record.receiptType === "root-operation") {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "receiptType",
        "receiptId",
        "operationId",
        "commandId",
        "commandSha256",
        "operation",
        "outcome",
        "occurredAt",
        "projectId",
        "affectedRootIds",
        "directoryIds",
        "eventIds"
      ],
      ["resultingRevision", "resultingSequence", "error"],
      "Root operation receipt"
    );
    const outcome2 = expectLiteral(
      record.outcome,
      ["applied", "no-op", "rejected", "cancelled", "timed-out"],
      "outcome"
    );
    const error2 = record.error === void 0 ? void 0 : parseProjectErrorV1(record.error);
    if ((outcome2 === "rejected" || outcome2 === "cancelled" || outcome2 === "timed-out") !== (error2 !== void 0)) {
      invalid(
        "Rejected, cancelled, or timed-out root receipts require an error; successful receipts must not contain one.",
        "error"
      );
    }
    if (outcome2 === "cancelled" && error2?.code !== "PROJECT_ROOT_RECOVERY_CANCELLED") {
      invalid("Cancelled root receipts require PROJECT_ROOT_RECOVERY_CANCELLED.", "error.code");
    }
    if (outcome2 === "timed-out" && error2?.code !== "PROJECT_ROOT_RECOVERY_TIMEOUT") {
      invalid("Timed-out root receipts require PROJECT_ROOT_RECOVERY_TIMEOUT.", "error.code");
    }
    const affectedRootIds = expectArray(record.affectedRootIds, "affectedRootIds").map(parseRootId);
    if (affectedRootIds.length === 0)
      invalid("A root operation receipt requires at least one affected root.", "affectedRootIds");
    expectUnique(affectedRootIds, "affectedRootIds", "PROJECT_DUPLICATE_ROOT");
    const directoryIds = expectArray(record.directoryIds, "directoryIds").map(parseDirectoryId);
    expectUnique(directoryIds, "directoryIds", "PROJECT_DUPLICATE_ROOT");
    const eventIds = expectArray(record.eventIds, "eventIds").map(parseProjectEventId);
    expectUnique(eventIds, "eventIds", "PROJECT_CONTRACT_INVALID");
    return Object.freeze({
      schemaVersion: 1,
      receiptType: "root-operation",
      receiptId: parseProjectReceiptId(record.receiptId),
      operationId: parseRootOperationId(record.operationId),
      commandId: parseProjectCommandId(record.commandId),
      commandSha256: expectSha256(record.commandSha256, "commandSha256"),
      operation: parseRootMutationKind(record.operation),
      outcome: outcome2,
      occurredAt: expectIsoTimestamp(record.occurredAt, "occurredAt"),
      projectId: parseProjectId(record.projectId),
      affectedRootIds: Object.freeze(affectedRootIds),
      directoryIds: Object.freeze(directoryIds),
      ...record.resultingRevision === void 0 ? {} : { resultingRevision: expectInteger(record.resultingRevision, "resultingRevision") },
      ...record.resultingSequence === void 0 ? {} : {
        resultingSequence: expectInteger(
          record.resultingSequence,
          "resultingSequence",
          outcome2 === "applied" || outcome2 === "no-op" ? 1 : 0
        )
      },
      eventIds: Object.freeze(eventIds),
      ...error2 === void 0 ? {} : { error: error2 }
    });
  }
  if (Object.hasOwn(record, "commandId")) {
    expectExactKeys(
      record,
      [
        "schemaVersion",
        "receiptId",
        "commandId",
        "admissionKind",
        "commandSha256",
        "outcome",
        "occurredAt",
        "eventIds"
      ],
      ["projectId", "resultingRevision", "resultingSequence", "error"],
      "Project mutation receipt"
    );
    const outcome2 = expectLiteral(record.outcome, ["applied", "no-op", "rejected"], "outcome");
    const error2 = record.error === void 0 ? void 0 : parseProjectErrorV1(record.error);
    if (outcome2 === "rejected" !== (error2 !== void 0))
      invalid("Rejected receipts require an error and successful receipts must not contain one.", "error");
    const eventIds = expectArray(record.eventIds, "eventIds").map(parseProjectEventId);
    expectUnique(eventIds, "eventIds", "PROJECT_CONTRACT_INVALID");
    return Object.freeze({
      schemaVersion: 1,
      receiptId: parseProjectReceiptId(record.receiptId),
      commandId: parseProjectCommandId(record.commandId),
      admissionKind: expectLiteral(
        record.admissionKind,
        ["project-command", "migration-bootstrap"],
        "admissionKind"
      ),
      commandSha256: expectSha256(record.commandSha256, "commandSha256"),
      outcome: outcome2,
      occurredAt: expectIsoTimestamp(record.occurredAt, "occurredAt"),
      ...record.projectId === void 0 ? {} : { projectId: parseProjectId(record.projectId) },
      ...record.resultingRevision === void 0 ? {} : { resultingRevision: expectInteger(record.resultingRevision, "resultingRevision") },
      ...record.resultingSequence === void 0 ? {} : {
        resultingSequence: expectInteger(
          record.resultingSequence,
          "resultingSequence",
          outcome2 === "rejected" ? 0 : 1
        )
      },
      eventIds: Object.freeze(eventIds),
      ...error2 === void 0 ? {} : { error: error2 }
    });
  }
  expectExactKeys(
    record,
    [
      "schemaVersion",
      "receiptId",
      "migrationId",
      "outcome",
      "sourceVersion",
      "targetVersion",
      "startedAt",
      "completedAt",
      "migratedProjectIds",
      "warnings",
      "containsSecretValues"
    ],
    ["archiveReference", "error"],
    "Project migration receipt"
  );
  const outcome = expectLiteral(record.outcome, ["migrated", "archived", "rolled-back", "failed"], "outcome");
  const error = record.error === void 0 ? void 0 : parseProjectErrorV1(record.error);
  if (outcome === "failed" !== (error !== void 0))
    invalid("Failed migration receipts require an error and completed receipts must not contain one.", "error");
  if (record.containsSecretValues !== false)
    invalid("Migration receipts must state that no secret values are present.", "containsSecretValues");
  const migratedProjectIds = expectArray(record.migratedProjectIds, "migratedProjectIds").map(parseProjectId);
  expectUnique(migratedProjectIds, "migratedProjectIds", "PROJECT_CONTRACT_INVALID");
  const warnings = expectArray(record.warnings, "warnings").map((warning) => expectString(warning, "warnings[]"));
  const startedAt = expectIsoTimestamp(record.startedAt, "startedAt");
  const completedAt = expectIsoTimestamp(record.completedAt, "completedAt");
  if (Date.parse(completedAt) < Date.parse(startedAt))
    invalid("Migration completion cannot precede its start.", "completedAt");
  return Object.freeze({
    schemaVersion: 1,
    receiptId: parseProjectReceiptId(record.receiptId),
    migrationId: parseOpaqueId(record.migrationId, "migrationId"),
    outcome,
    sourceVersion: expectString(record.sourceVersion, "sourceVersion"),
    targetVersion: expectString(record.targetVersion, "targetVersion"),
    startedAt,
    completedAt,
    ...record.archiveReference === void 0 ? {} : { archiveReference: parseOpaqueId(record.archiveReference, "archiveReference") },
    migratedProjectIds: Object.freeze(migratedProjectIds),
    warnings: Object.freeze(warnings),
    ...error === void 0 ? {} : { error },
    containsSecretValues: false
  });
}
export {
  DIRECTORY_BINDING_HISTORY_LIMIT,
  PROJECT_ERROR_CODES,
  PROJECT_SCHEMA_VERSION,
  ProjectContractError,
  parseBindingId,
  parseCanonicalAbsolutePath,
  parseDeviceId,
  parseDeviceIdentityV1,
  parseDirectoryBindingHistoryEntryV1,
  parseDirectoryBindingProjectionV1,
  parseDirectoryCandidateRef,
  parseDirectoryDeviceBindingV1,
  parseDirectoryId,
  parseDirectoryMarkerIndexCoverageV1,
  parseDirectoryMarkerIndexV1,
  parseDirectoryMarkerObservationV1,
  parseDirectoryMarkerV1,
  parseDirectoryObservationId,
  parseOpaqueId,
  parseProjectBriefMetadataV1,
  parseProjectBriefV1,
  parseProjectCommandId,
  parseProjectCommandV1,
  parseProjectCreationRootIntentV1,
  parseProjectDefaultsV1,
  parseProjectEventId,
  parseProjectEventV1,
  parseProjectId,
  parseProjectReceiptId,
  parseProjectReceiptV1,
  parseProjectRecordV1,
  parseProjectRootLocationV1,
  parseProjectRootV1,
  parseProjectSnapshotV1,
  parseRootId,
  parseRootOperationArtifactV1,
  parseRootOperationId,
  parseRootOperationJournalV1,
  parseRootRecoveryResultV1,
  parseSessionId,
  parseSessionPreflightReceiptId,
  parseSessionWorkspaceBindingDocumentV1,
  parseSessionWorkspaceBindingV1,
  parseVaultId,
  parseVaultIdentityV1,
  parseVaultRelativePath,
  projectDirectoryBinding,
  projectProjectDetail,
  projectProjectStructure,
  projectProjectSummary
};
