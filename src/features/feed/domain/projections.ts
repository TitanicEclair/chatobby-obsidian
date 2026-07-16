import type { FeedBlock } from "../../../types";

/** Flat, materialized feed document supplied by a read-model projection. */
export interface FeedDocumentProjection {
  readonly blocks: readonly FeedBlock[];
}
