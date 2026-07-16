export interface ObsidianRetrievalBackendStatus {
    name: "graphify" | "smart-connections" | "lexical" | "obsidian-links" | "plugin-finalized";
    available: boolean;
    stale?: boolean;
    sourceMtime?: number;
    reason?: string;
}
export interface ObsidianRetrievalWarning {
    code: "GRAPHIFY_UNAVAILABLE" | "SMART_CONNECTIONS_UNAVAILABLE" | "EMBEDDING_FAILED" | "STALE_COMPONENT_DATA" | "PLUGIN_FINALIZED";
    message: string;
}
export interface ObsidianGraphComponent {
    nodes: Array<{
        path: string;
        label?: string;
        degree?: number;
        communityId?: string;
    }>;
    edges: Array<{
        sourcePath: string;
        targetPath: string;
        weight?: number;
        type?: string;
    }>;
    communities?: Array<{
        id: string;
        label?: string;
        hubPaths?: string[];
    }>;
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
export type ObsidianRetrievalEvidenceKind = "content-match" | "path-match" | "alias-match" | "tag-match" | "property-match" | "wikilink" | "backlink" | "graph-edge" | "semantic-vector" | "community" | "hub";
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
/**
 * Parse an unknown value into a validated ObsidianRetrievalEnvelope.
 *
 * Covers complete, partial, unavailable, stale, and warning-bearing envelopes.
 * Missing Graphify or Smart Connections capability is represented as backend
 * status and warnings, not an unrelated thrown tool failure.
 */
export declare function parseRetrievalEnvelope(input: unknown): ObsidianRetrievalEnvelope;
