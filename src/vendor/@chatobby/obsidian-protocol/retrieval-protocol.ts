// Retrieval envelope types and parser for the Obsidian bridge protocol.
// The plugin provides component payloads. The server performs deterministic
// fusion, pagination, fallback, and MCP shaping.

export interface ObsidianRetrievalBackendStatus {
	name: "graphify" | "smart-connections" | "lexical" | "obsidian-links" | "plugin-finalized";
	available: boolean;
	stale?: boolean;
	sourceMtime?: number;
	reason?: string;
}

export interface ObsidianRetrievalWarning {
	code:
		| "GRAPHIFY_UNAVAILABLE"
		| "SMART_CONNECTIONS_UNAVAILABLE"
		| "EMBEDDING_FAILED"
		| "STALE_COMPONENT_DATA"
		| "PLUGIN_FINALIZED";
	message: string;
}

export interface ObsidianGraphComponent {
	nodes: Array<{ path: string; label?: string; degree?: number; communityId?: string }>;
	edges: Array<{ sourcePath: string; targetPath: string; weight?: number; type?: string }>;
	communities?: Array<{ id: string; label?: string; hubPaths?: string[] }>;
	source?: "merged" | "graphify" | "obsidian-links";
}

export interface ObsidianSemanticHit {
	path: string;
	score: number;
	model?: string;
	provider?: string;
	excerpt?: string;
}

export type ObsidianRetrievalEvidenceProvider = "lexical" | "obsidian-links" | "graphify" | "smart-connections";
export type ObsidianRetrievalEvidenceKind =
	| "content-match"
	| "path-match"
	| "alias-match"
	| "tag-match"
	| "property-match"
	| "wikilink"
	| "backlink"
	| "graph-edge"
	| "semantic-vector"
	| "community"
	| "hub";

export interface ObsidianRetrievalEvidence {
	provider: ObsidianRetrievalEvidenceProvider;
	kind: ObsidianRetrievalEvidenceKind;
	score?: number;
	excerpt?: string;
	sourcePath?: string;
	targetPath?: string;
	relation?: string;
	stale?: boolean;
	model?: string;
}

export interface ObsidianRetrievalCandidate {
	path: string;
	title?: string;
	score: number;
	confidence: "exact" | "strong" | "weak" | "lead";
	evidence: ObsidianRetrievalEvidence[];
	needsRead: boolean;
}

export interface ObsidianRetrievalDiagnostics {
	backends?: ObsidianRetrievalBackendStatus[];
	graphify?: {
		available: boolean;
		stale?: boolean;
		sourceMtime?: number;
		nodeCount?: number;
		edgeCount?: number;
		duplicatePathCount?: number;
		vaultFilesMissingFromGraph?: number;
		graphNodesMissingVaultFiles?: number;
	};
	smartConnections?: {
		available: boolean;
		liveAvailable?: boolean;
		ajsonAvailable?: boolean;
		model?: string;
		dimension?: number;
		indexedNoteCount?: number;
		sourceMtime?: number;
		reason?: string;
	};
	lexical?: {
		searchedFileCount?: number;
	};
}

export interface ObsidianRetrievalEnvelope {
	query?: string;
	subjectPath?: string;
	available: boolean;
	partial: boolean;
	backends: ObsidianRetrievalBackendStatus[];
	graph?: ObsidianGraphComponent;
	semanticHits?: ObsidianSemanticHit[];
	candidates?: ObsidianRetrievalCandidate[];
	diagnostics?: ObsidianRetrievalDiagnostics;
	warnings: ObsidianRetrievalWarning[];
}

const VALID_BACKEND_NAMES = new Set(["graphify", "smart-connections", "lexical", "obsidian-links", "plugin-finalized"]);
const VALID_WARNING_CODES = new Set([
	"GRAPHIFY_UNAVAILABLE",
	"SMART_CONNECTIONS_UNAVAILABLE",
	"EMBEDDING_FAILED",
	"STALE_COMPONENT_DATA",
	"PLUGIN_FINALIZED",
]);

function parseBackendStatus(input: unknown): ObsidianRetrievalBackendStatus {
	if (input === null || typeof input !== "object") {
		throw new TypeError("Backend status must be an object");
	}
	const obj = input as Record<string, unknown>;
	if (typeof obj.name !== "string" || !VALID_BACKEND_NAMES.has(obj.name)) {
		throw new TypeError(`Invalid backend name: ${String(obj.name)}`);
	}
	if (typeof obj.available !== "boolean") {
		throw new TypeError("Backend available must be a boolean");
	}
	const result: ObsidianRetrievalBackendStatus = {
		name: obj.name as ObsidianRetrievalBackendStatus["name"],
		available: obj.available,
	};
	if (obj.stale !== undefined) {
		if (typeof obj.stale !== "boolean") throw new TypeError("Backend stale must be a boolean");
		result.stale = obj.stale;
	}
	if (obj.sourceMtime !== undefined) {
		if (typeof obj.sourceMtime !== "number") throw new TypeError("Backend sourceMtime must be a number");
		result.sourceMtime = obj.sourceMtime;
	}
	if (obj.reason !== undefined) {
		if (typeof obj.reason !== "string") throw new TypeError("Backend reason must be a string");
		result.reason = obj.reason;
	}
	return result;
}

function parseWarning(input: unknown): ObsidianRetrievalWarning {
	if (input === null || typeof input !== "object") {
		throw new TypeError("Retrieval warning must be an object");
	}
	const obj = input as Record<string, unknown>;
	if (typeof obj.code !== "string" || !VALID_WARNING_CODES.has(obj.code)) {
		throw new TypeError(`Invalid retrieval warning code: ${String(obj.code)}`);
	}
	if (typeof obj.message !== "string") {
		throw new TypeError("Retrieval warning message must be a string");
	}
	return { code: obj.code as ObsidianRetrievalWarning["code"], message: obj.message };
}

function parseGraphComponent(input: unknown): ObsidianGraphComponent {
	if (input === null || typeof input !== "object") {
		throw new TypeError("Graph component must be an object");
	}
	const obj = input as Record<string, unknown>;

	if (!Array.isArray(obj.nodes)) throw new TypeError("Graph nodes must be an array");
	const nodes = obj.nodes.map((n: unknown) => {
		if (n === null || typeof n !== "object") throw new TypeError("Graph node must be an object");
		const node = n as Record<string, unknown>;
		if (typeof node.path !== "string") throw new TypeError("Graph node path must be a string");
		const result: { path: string; label?: string; degree?: number; communityId?: string } = { path: node.path };
		if (node.label !== undefined) {
			if (typeof node.label !== "string") throw new TypeError("Graph node label must be a string");
			result.label = node.label;
		}
		if (node.degree !== undefined) {
			if (typeof node.degree !== "number") throw new TypeError("Graph node degree must be a number");
			result.degree = node.degree;
		}
		if (node.communityId !== undefined) {
			if (typeof node.communityId !== "string") throw new TypeError("Graph node communityId must be a string");
			result.communityId = node.communityId;
		}
		return result;
	});

	if (!Array.isArray(obj.edges)) throw new TypeError("Graph edges must be an array");
	const edges = obj.edges.map((e: unknown) => {
		if (e === null || typeof e !== "object") throw new TypeError("Graph edge must be an object");
		const edge = e as Record<string, unknown>;
		if (typeof edge.sourcePath !== "string") throw new TypeError("Graph edge sourcePath must be a string");
		if (typeof edge.targetPath !== "string") throw new TypeError("Graph edge targetPath must be a string");
		const result: { sourcePath: string; targetPath: string; weight?: number; type?: string } = {
			sourcePath: edge.sourcePath,
			targetPath: edge.targetPath,
		};
		if (edge.weight !== undefined) {
			if (typeof edge.weight !== "number") throw new TypeError("Graph edge weight must be a number");
			result.weight = edge.weight;
		}
		if (edge.type !== undefined) {
			if (typeof edge.type !== "string") throw new TypeError("Graph edge type must be a string");
			result.type = edge.type;
		}
		return result;
	});

	const result: ObsidianGraphComponent = { nodes, edges };

	if (obj.communities !== undefined) {
		if (!Array.isArray(obj.communities)) throw new TypeError("Graph communities must be an array");
		result.communities = obj.communities.map((c: unknown) => {
			if (c === null || typeof c !== "object") throw new TypeError("Community must be an object");
			const comm = c as Record<string, unknown>;
			if (typeof comm.id !== "string") throw new TypeError("Community id must be a string");
			const entry: { id: string; label?: string; hubPaths?: string[] } = { id: comm.id };
			if (comm.label !== undefined) {
				if (typeof comm.label !== "string") throw new TypeError("Community label must be a string");
				entry.label = comm.label;
			}
			if (comm.hubPaths !== undefined) {
				if (!Array.isArray(comm.hubPaths)) throw new TypeError("Community hubPaths must be an array");
				entry.hubPaths = comm.hubPaths.map((h: unknown) => {
					if (typeof h !== "string") throw new TypeError("Hub path must be a string");
					return h;
				});
			}
			return entry;
		});
	}
	if (obj.source !== undefined) {
		if (obj.source !== "merged" && obj.source !== "graphify" && obj.source !== "obsidian-links") {
			throw new TypeError("Graph source must be merged, graphify, or obsidian-links");
		}
		result.source = obj.source;
	}

	return result;
}

function parseSemanticHit(input: unknown): ObsidianSemanticHit {
	if (input === null || typeof input !== "object") {
		throw new TypeError("Semantic hit must be an object");
	}
	const obj = input as Record<string, unknown>;
	if (typeof obj.path !== "string") throw new TypeError("Semantic hit path must be a string");
	if (typeof obj.score !== "number") throw new TypeError("Semantic hit score must be a number");
	const result: ObsidianSemanticHit = { path: obj.path, score: obj.score };
	if (obj.model !== undefined) {
		if (typeof obj.model !== "string") throw new TypeError("Semantic hit model must be a string");
		result.model = obj.model;
	}
	if (obj.provider !== undefined) {
		if (typeof obj.provider !== "string") throw new TypeError("Semantic hit provider must be a string");
		result.provider = obj.provider;
	}
	if (obj.excerpt !== undefined) {
		if (typeof obj.excerpt !== "string") throw new TypeError("Semantic hit excerpt must be a string");
		result.excerpt = obj.excerpt;
	}
	return result;
}

function parseEvidence(input: unknown): ObsidianRetrievalEvidence {
	if (input === null || typeof input !== "object") throw new TypeError("Retrieval evidence must be an object");
	const obj = input as Record<string, unknown>;
	if (
		obj.provider !== "lexical" &&
		obj.provider !== "obsidian-links" &&
		obj.provider !== "graphify" &&
		obj.provider !== "smart-connections"
	) {
		throw new TypeError(`Invalid retrieval evidence provider: ${String(obj.provider)}`);
	}
	const validKinds = new Set([
		"content-match",
		"path-match",
		"alias-match",
		"tag-match",
		"property-match",
		"wikilink",
		"backlink",
		"graph-edge",
		"semantic-vector",
		"community",
		"hub",
	]);
	if (typeof obj.kind !== "string" || !validKinds.has(obj.kind)) {
		throw new TypeError(`Invalid retrieval evidence kind: ${String(obj.kind)}`);
	}
	const result: ObsidianRetrievalEvidence = {
		provider: obj.provider,
		kind: obj.kind as ObsidianRetrievalEvidenceKind,
	};
	for (const key of ["excerpt", "sourcePath", "targetPath", "relation", "model"] as const) {
		if (obj[key] !== undefined) {
			if (typeof obj[key] !== "string") throw new TypeError(`Retrieval evidence ${key} must be a string`);
			result[key] = obj[key];
		}
	}
	if (obj.score !== undefined) {
		if (typeof obj.score !== "number") throw new TypeError("Retrieval evidence score must be a number");
		result.score = obj.score;
	}
	if (obj.stale !== undefined) {
		if (typeof obj.stale !== "boolean") throw new TypeError("Retrieval evidence stale must be a boolean");
		result.stale = obj.stale;
	}
	return result;
}

function parseCandidate(input: unknown): ObsidianRetrievalCandidate {
	if (input === null || typeof input !== "object") throw new TypeError("Retrieval candidate must be an object");
	const obj = input as Record<string, unknown>;
	if (typeof obj.path !== "string") throw new TypeError("Retrieval candidate path must be a string");
	if (typeof obj.score !== "number") throw new TypeError("Retrieval candidate score must be a number");
	if (
		obj.confidence !== "exact" &&
		obj.confidence !== "strong" &&
		obj.confidence !== "weak" &&
		obj.confidence !== "lead"
	) {
		throw new TypeError("Retrieval candidate confidence must be exact, strong, weak, or lead");
	}
	if (!Array.isArray(obj.evidence)) throw new TypeError("Retrieval candidate evidence must be an array");
	if (typeof obj.needsRead !== "boolean") throw new TypeError("Retrieval candidate needsRead must be a boolean");
	const result: ObsidianRetrievalCandidate = {
		path: obj.path,
		score: obj.score,
		confidence: obj.confidence,
		evidence: obj.evidence.map(parseEvidence),
		needsRead: obj.needsRead,
	};
	if (obj.title !== undefined) {
		if (typeof obj.title !== "string") throw new TypeError("Retrieval candidate title must be a string");
		result.title = obj.title;
	}
	return result;
}

function parseDiagnostics(input: unknown): ObsidianRetrievalDiagnostics {
	if (input === null || typeof input !== "object") throw new TypeError("Retrieval diagnostics must be an object");
	return input as ObsidianRetrievalDiagnostics;
}

/**
 * Parse an unknown value into a validated ObsidianRetrievalEnvelope.
 *
 * Covers complete, partial, unavailable, stale, and warning-bearing envelopes.
 * Missing Graphify or Smart Connections capability is represented as backend
 * status and warnings, not an unrelated thrown tool failure.
 */
export function parseRetrievalEnvelope(input: unknown): ObsidianRetrievalEnvelope {
	if (input === null || typeof input !== "object") {
		throw new TypeError("Retrieval envelope must be an object");
	}
	const obj = input as Record<string, unknown>;

	if (typeof obj.available !== "boolean") {
		throw new TypeError("Retrieval envelope available must be a boolean");
	}
	if (typeof obj.partial !== "boolean") {
		throw new TypeError("Retrieval envelope partial must be a boolean");
	}
	if (!Array.isArray(obj.backends)) {
		throw new TypeError("Retrieval envelope backends must be an array");
	}
	if (!Array.isArray(obj.warnings)) {
		throw new TypeError("Retrieval envelope warnings must be an array");
	}

	const result: ObsidianRetrievalEnvelope = {
		available: obj.available,
		partial: obj.partial,
		backends: obj.backends.map(parseBackendStatus),
		warnings: obj.warnings.map(parseWarning),
	};

	if (obj.query !== undefined) {
		if (typeof obj.query !== "string") throw new TypeError("Retrieval envelope query must be a string");
		result.query = obj.query;
	}
	if (obj.subjectPath !== undefined) {
		if (typeof obj.subjectPath !== "string") throw new TypeError("Retrieval envelope subjectPath must be a string");
		result.subjectPath = obj.subjectPath;
	}
	if (obj.graph !== undefined) {
		result.graph = parseGraphComponent(obj.graph);
	}
	if (obj.semanticHits !== undefined) {
		if (!Array.isArray(obj.semanticHits)) throw new TypeError("Semantic hits must be an array");
		result.semanticHits = obj.semanticHits.map(parseSemanticHit);
	}
	if (obj.candidates !== undefined) {
		if (!Array.isArray(obj.candidates)) throw new TypeError("Retrieval candidates must be an array");
		result.candidates = obj.candidates.map(parseCandidate);
	}
	if (obj.diagnostics !== undefined) {
		result.diagnostics = parseDiagnostics(obj.diagnostics);
	}

	return result;
}
