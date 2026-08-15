// Generated from packages/chatobby-local-models/src/contracts.ts. Do not edit.
export const MANAGED_LOCAL_MODEL_ENGINES = ["llama-cpp"] as const;
export const MANAGED_LOCAL_MODEL_LAUNCH_POLICIES = ["manual", "on-demand", "runtime-start"] as const;
export const LLAMA_CPP_CACHE_TYPES = ["f16", "q8_0", "q4_0"] as const;

export type ManagedLocalModelEngine = (typeof MANAGED_LOCAL_MODEL_ENGINES)[number];
export type ManagedLocalModelLaunchPolicy = (typeof MANAGED_LOCAL_MODEL_LAUNCH_POLICIES)[number];
export type LlamaCppCacheType = (typeof LLAMA_CPP_CACHE_TYPES)[number];

export interface LlamaCppManagedSettingsV1 {
	readonly contextSize: number;
	readonly gpuLayers: number;
	readonly cacheTypeK: LlamaCppCacheType;
	readonly cacheTypeV: LlamaCppCacheType;
	readonly flashAttention: boolean;
	readonly threads?: number;
	readonly batchSize?: number;
	readonly microBatchSize?: number;
	readonly parallelSlots?: number;
}

export interface ManagedLocalModelServerProfileV1 {
	readonly schemaVersion: 1;
	readonly id: string;
	readonly providerId: string;
	readonly name: string;
	readonly engine: "llama-cpp";
	readonly launchPolicy: ManagedLocalModelLaunchPolicy;
	readonly executablePath: string;
	readonly modelPath: string;
	readonly host: "127.0.0.1";
	readonly port: number;
	readonly settings: LlamaCppManagedSettingsV1;
	readonly startupTimeoutSeconds: number;
}

export interface ManagedLocalModelServerDocumentV1 {
	readonly schemaVersion: 1;
	readonly revision: number;
	readonly profiles: readonly ManagedLocalModelServerProfileV1[];
	readonly updatedAt: string;
	readonly containsSecretValues: false;
}

export type ManagedLocalModelServerPhase =
	| "stopped"
	| "preflighting"
	| "starting"
	| "probing"
	| "ready"
	| "stopping"
	| "failed";

export type ManagedLocalModelServerFailureCode =
	| "EXECUTABLE_MISSING"
	| "MODEL_MISSING"
	| "PORT_UNAVAILABLE"
	| "OWNED_BY_ANOTHER_RUNTIME"
	| "PROCESS_EXITED"
	| "STARTUP_TIMEOUT"
	| "HEALTH_CHECK_FAILED"
	| "STOP_FAILED";

export interface ManagedLocalModelServerStatusV1 {
	readonly schemaVersion: 1;
	readonly profileId: string;
	readonly providerId: string;
	readonly phase: ManagedLocalModelServerPhase;
	readonly ownership: "this-runtime" | "other-runtime" | "none";
	readonly ready: boolean;
	readonly pid?: number;
	readonly startedAt?: string;
	readonly checkedAt: string;
	readonly failure?: {
		readonly code: ManagedLocalModelServerFailureCode;
		readonly retryable: boolean;
		readonly message: string;
		/** Bounded, path-scrubbed process output for local troubleshooting. */
		readonly diagnostic?: string;
	};
}

export interface ManagedLocalModelServerSnapshotV1 {
	readonly schemaVersion: 1;
	readonly document: ManagedLocalModelServerDocumentV1;
	readonly statuses: readonly ManagedLocalModelServerStatusV1[];
}

export function parseManagedLocalModelServerProfile(value: unknown): ManagedLocalModelServerProfileV1 {
	if (!isRecord(value) || value.schemaVersion !== 1 || value.engine !== "llama-cpp") {
		throw new Error("Managed local model server profile is invalid.");
	}
	if (!MANAGED_LOCAL_MODEL_LAUNCH_POLICIES.includes(value.launchPolicy as ManagedLocalModelLaunchPolicy)) {
		throw new Error("Managed local model launch policy is invalid.");
	}
	if (value.host !== "127.0.0.1") throw new Error("Managed local model servers must bind to 127.0.0.1.");
	const settings = parseLlamaCppSettings(value.settings);
	return Object.freeze({
		schemaVersion: 1,
		id: identifier(value.id, "Managed server profile id"),
		providerId: identifier(value.providerId, "Managed server provider id"),
		name: text(value.name, "Managed server name", 120),
		engine: "llama-cpp",
		launchPolicy: value.launchPolicy as ManagedLocalModelLaunchPolicy,
		executablePath: absolutePath(value.executablePath, "llama.cpp executable path"),
		modelPath: absolutePath(value.modelPath, "GGUF model path"),
		host: "127.0.0.1",
		port: integer(value.port, "Server port", 1, 65_535),
		settings,
		startupTimeoutSeconds: integer(value.startupTimeoutSeconds ?? 180, "Startup timeout", 10, 900),
	});
}

export function parseManagedLocalModelServerDocument(value: unknown): ManagedLocalModelServerDocumentV1 {
	if (!isRecord(value) || value.schemaVersion !== 1 || value.containsSecretValues !== false) {
		throw new Error("Managed local model server document is invalid.");
	}
	const revision = integer(value.revision, "Managed server document revision", 0, Number.MAX_SAFE_INTEGER);
	if (!Array.isArray(value.profiles) || value.profiles.length > 64) {
		throw new Error("Managed server profile collection is invalid.");
	}
	const profiles = value.profiles.map(parseManagedLocalModelServerProfile);
	unique(
		profiles.map((profile) => profile.id),
		"Managed server profile ids",
	);
	unique(
		profiles.map((profile) => profile.providerId),
		"Managed server provider ids",
	);
	const updatedAt = text(value.updatedAt, "Managed server updated timestamp", 64);
	if (!Number.isFinite(Date.parse(updatedAt))) throw new Error("Managed server updated timestamp is invalid.");
	return Object.freeze({
		schemaVersion: 1,
		revision,
		profiles: Object.freeze(profiles),
		updatedAt,
		containsSecretValues: false,
	});
}

function parseLlamaCppSettings(value: unknown): LlamaCppManagedSettingsV1 {
	if (!isRecord(value)) throw new Error("llama.cpp settings are invalid.");
	if (!LLAMA_CPP_CACHE_TYPES.includes(value.cacheTypeK as LlamaCppCacheType)) {
		throw new Error("llama.cpp K cache type is invalid.");
	}
	if (!LLAMA_CPP_CACHE_TYPES.includes(value.cacheTypeV as LlamaCppCacheType)) {
		throw new Error("llama.cpp V cache type is invalid.");
	}
	if (typeof value.flashAttention !== "boolean") throw new Error("llama.cpp flash attention must be explicit.");
	if (value.cacheTypeV !== "f16" && !value.flashAttention) {
		throw new Error("llama.cpp quantized V cache requires flash attention.");
	}
	return Object.freeze({
		contextSize: integer(value.contextSize, "llama.cpp context size", 512, 2_000_000),
		gpuLayers: integer(value.gpuLayers, "llama.cpp GPU layers", 0, 10_000),
		cacheTypeK: value.cacheTypeK as LlamaCppCacheType,
		cacheTypeV: value.cacheTypeV as LlamaCppCacheType,
		flashAttention: value.flashAttention,
		...(value.threads === undefined ? {} : { threads: integer(value.threads, "llama.cpp threads", 1, 1024) }),
		...(value.batchSize === undefined
			? {}
			: { batchSize: integer(value.batchSize, "llama.cpp batch size", 1, 65_536) }),
		...(value.microBatchSize === undefined
			? {}
			: { microBatchSize: integer(value.microBatchSize, "llama.cpp micro batch size", 1, 65_536) }),
		...(value.parallelSlots === undefined
			? {}
			: { parallelSlots: integer(value.parallelSlots, "llama.cpp parallel slots", 1, 64) }),
	});
}

function identifier(value: unknown, label: string): string {
	const result = text(value, label, 96).toLowerCase();
	if (!/^[a-z0-9][a-z0-9._-]*$/u.test(result)) throw new Error(`${label} is invalid.`);
	return result;
}

function absolutePath(value: unknown, label: string): string {
	const result = text(value, label, 4096);
	if (!/^(?:[a-zA-Z]:[\\/]|\\\\|\/)/u.test(result) || result.includes("\0")) {
		throw new Error(`${label} must be absolute.`);
	}
	return result;
}

function text(value: unknown, label: string, maximum: number): string {
	if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
		throw new Error(`${label} is invalid.`);
	}
	return value.trim();
}

function integer(value: unknown, label: string, minimum: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
		throw new Error(`${label} is invalid.`);
	}
	return value as number;
}

function unique(values: readonly string[], label: string): void {
	if (new Set(values).size !== values.length) throw new Error(`${label} must be unique.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
