/** Per-tab session state with an isolated normalized feed store. */
export type { SessionTab } from "./domain/session-tab";

/** Creates a new tab while carrying only explicit session preferences forward. */
export { createSessionTab } from "./domain/session-tab";

/** Path-addressed maintenance producer for persisted sessions. */
export { StoredSessionController } from "./application/stored-session-controller";

/** Shared connector defaults; callers retain their existing object identity. */
export { DEFAULT_SESSION_PREFERENCES } from "./domain/preferences";

/** Connector-local preferences and session projections; runtime state remains authoritative. */
export type { SessionPreferences, PermissionMode } from "./domain/preferences";

/** Shared connector defaults; callers retain their existing object identity. */
export { DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT, EMPTY_SESSION_STATE } from "./domain/state";

/** Connector-local preferences and session projections; runtime state remains authoritative. */
export type { WsSessionState, SessionState, SessionListItem, SessionEvent } from "./domain/state";
