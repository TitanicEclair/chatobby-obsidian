import type { ObsidianGraphComponent, ObsidianRetrievalBackendStatus, ObsidianRetrievalWarning } from "../../vendor/@chatobby/obsidian-protocol/retrieval-protocol";

export interface GraphifyNode {
  id: string;
  label?: string;
  source_file?: string;
  community?: number;
  degree?: number;
}

export interface GraphifyLink {
  source: string;
  target: string;
  relation?: string;
  weight?: number;
}

export interface GraphifyGraphData {
  nodes: GraphifyNode[];
  links: GraphifyLink[];
}

export interface GraphifySnapshot {
  graph: GraphifyGraphData;
  labels: Map<number, string>;
  undirectedAdjacency: Map<string, Set<string>>;
  outgoingAdjacency: Map<string, Set<string>>;
  degree: Map<string, number>;
  nodeCommunity: Map<string, number>;
  pathToNode: Map<string, string>;
  loadedAt: string;
  sourceMtime: number;
  warnings: ObsidianRetrievalWarning[];
}

export interface SemanticHit {
  path: string;
  score: number;
  model?: string;
  provider: "smart-connections" | "smart-connections-live" | "lexical";
  excerpt?: string;
}

export interface SemanticIndexStatus {
  available: boolean;
  queryEmbedding: boolean;
  model?: string;
  dimension?: number;
  noteCount?: number;
  loadedAt?: string;
  sourceMtime?: number;
  provider?: string;
  providerVersion?: string;
  reason?: string;
}

export interface SemanticIndexAdapter {
  status(): SemanticIndexStatus;
  relatedToPath(notePath: string, limit: number): Promise<SemanticHit[]>;
  searchText?(query: string, limit: number): Promise<SemanticHit[]>;
  isStale?(): Promise<boolean>;
  refresh?(): Promise<void>;
}

export interface RetrievalEnvelopeParts {
  available: boolean;
  partial: boolean;
  backends: ObsidianRetrievalBackendStatus[];
  warnings: ObsidianRetrievalWarning[];
}

export type GraphComponent = ObsidianGraphComponent;
