import type { FeedBlock } from "./presentation";

/** Flat, materialized feed document supplied by a read-model projection. */
export interface FeedDocumentProjection {
  readonly blocks: readonly FeedBlock[];
}
