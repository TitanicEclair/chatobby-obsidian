/** Per-tab session state with an isolated normalized feed store. */
export type { SessionTab } from "./domain/session-tab";

/** Creates a new tab while carrying only explicit session preferences forward. */
export { createSessionTab } from "./domain/session-tab";

/** Path-addressed maintenance producer for persisted sessions. */
export { StoredSessionController } from "./application/stored-session-controller";
