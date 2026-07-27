const DEFAULT_TTL_MS = 15 * 60 * 1_000;
const DEFAULT_MAX_BYTES = 64 * 1_024 * 1_024;

export interface BrowserSemanticArtifact {
  documentId: string;
  revision: number;
  leafId: string;
  capturedAt: string;
  page: Record<string, unknown>;
  metadata: Record<string, unknown>;
  root: Record<string, unknown>;
  blocks: Array<Record<string, unknown>>;
  outline: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  coverage: Record<string, unknown>;
  captureTruncated: boolean;
}

interface RetainedArtifact {
  artifact: BrowserSemanticArtifact;
  bytes: number;
  lastAccessedAt: number;
}

function artifactKey(documentId: string, revision: number): string {
  return `${documentId}:${revision}`;
}

function estimateBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export class BrowserArtifactStore {
  private readonly entries = new Map<string, RetainedArtifact>();
  private totalBytes = 0;

  constructor(
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly maxBytes = DEFAULT_MAX_BYTES,
    private readonly now: () => number = Date.now,
  ) {}

  get(documentId: string, revision: number): BrowserSemanticArtifact | undefined {
    this.removeExpired();
    const key = artifactKey(documentId, revision);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    entry.lastAccessedAt = this.now();
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.artifact;
  }

  put(artifact: BrowserSemanticArtifact): void {
    this.removeExpired();
    const key = artifactKey(artifact.documentId, artifact.revision);
    const existing = this.entries.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.entries.delete(key);
    }
    const bytes = estimateBytes(artifact);
    if (bytes > this.maxBytes) return;
    this.entries.set(key, { artifact, bytes, lastAccessedAt: this.now() });
    this.totalBytes += bytes;
    this.enforceLimit();
  }

  deleteDocument(documentId: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.artifact.documentId !== documentId) continue;
      this.entries.delete(key);
      this.totalBytes -= entry.bytes;
    }
  }

  deleteLeaf(leafId: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.artifact.leafId !== leafId) continue;
      this.entries.delete(key);
      this.totalBytes -= entry.bytes;
    }
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  private removeExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [key, entry] of this.entries) {
      if (entry.lastAccessedAt >= cutoff) continue;
      this.entries.delete(key);
      this.totalBytes -= entry.bytes;
    }
  }

  private enforceLimit(): void {
    while (this.totalBytes > this.maxBytes) {
      const oldest = this.entries.entries().next();
      if (oldest.done) break;
      const [key, entry] = oldest.value;
      this.entries.delete(key);
      this.totalBytes -= entry.bytes;
    }
  }
}
