// Chatobby UI constants — every magic number has a name.
// All numeric constants live here. No magic numbers in component files.

// ── Streaming render debounce (per content type) ──────────────────────
// Each content type gets its own debounce interval. Thinking blocks tolerate
// more latency (user usually has them collapsed); text needs to feel responsive;
// tool calls are discrete events and render immediately.
//
// These drive the segment-based incremental renderer in feed/streaming-segment.ts.
// Each ContentSegment owns its own timer at the interval for its type.

/** Debounce for thinking block renders during streaming (ms). Longer — user usually has it collapsed. */
export const STREAM_THINKING_DEBOUNCE_MS = 300;

/** Debounce for text block renders during streaming (ms). Balances responsiveness against
 *  the cost of full-markdown DOM rebuilds — every render tears down and recreates the
 *  entire text block through Obsidian's synchronous MarkdownRenderer. */
export const STREAM_TEXT_DEBOUNCE_MS = 32;

/** Maximum cadence for parsing and decorating the growing Markdown response.
 * Feed text can update more frequently, but a full Markdown pass is deliberately
 * bounded so streaming cannot monopolize Obsidian's UI thread. */
export const STREAM_MARKDOWN_RENDER_MS = 96;

/** Debounce for tool call renders during streaming (ms). Zero — discrete events, render immediately. */
export const STREAM_TOOLCALL_DEBOUNCE_MS = 250;

/** Pixels from bottom to consider "at bottom" for auto-scroll. */
export const SCROLL_BOTTOM_THRESHOLD_PX = 48;

/** Minimum upward scroll motion (px) treated as the reader stopping auto-follow.
 *  Sub-pixel guard so rounding noise from programmatic snaps never reads as intent. */
export const SCROLL_DETACH_DELTA_PX = 1;

/** Base delay for reconnect attempts (ms). Doubles each attempt. */
export const RECONNECT_BASE_DELAY_MS = 2000;

/** Maximum reconnect delay (ms). Backoff caps here. */
export const RECONNECT_MAX_DELAY_MS = 30_000;

/** Maximum reconnect attempts before giving up. */
export const RECONNECT_MAX_ATTEMPTS = 10;

/** Minimum delay between frontend snapshot resynchronization attempts. */
export const FRONTEND_RESYNC_MIN_INTERVAL_MS = 1000;

/** Maximum cadence for applying streamed frontend snapshots to Obsidian UI state. */
export const FRONTEND_RENDER_BATCH_MS = 50;

/** Current data-only frontend schema version. */
export const FRONTEND_SCHEMA_VERSION = 1;

/** Maximum composer textarea height in pixels before scrolling. */
export const COMPOSER_MAX_HEIGHT_PX = 200;

/** Throttle interval for scroll event handling (ms). */
export const SCROLL_THROTTLE_MS = 16;

/** Duration for toast notifications (ms). */
export const NOTICE_DURATION_MS = 3000;

/** Poll cadence for live token/context stats while a turn is active. */
export const LIVE_STATS_POLL_MS = 1000;

/** User-configurable bounds for model-specific automatic compaction. */
export const AUTO_COMPACTION_MIN_THRESHOLD_PERCENT = 50;
export const AUTO_COMPACTION_MAX_THRESHOLD_PERCENT = 95;
export const AUTO_COMPACTION_THRESHOLD_STEP_PERCENT = 1;

// ── Bridge executor constants ──────────────────────────────────────────

/** Interval for bridge WebSocket ping keepalive (ms). */
export const BRIDGE_PING_INTERVAL_MS = 30_000;

/** Default deadline for bridge operations (ms). */
export const BRIDGE_DEFAULT_DEADLINE_MS = 30_000;

/** Default timeout for bridge requests (ms). */
export const BRIDGE_REQUEST_TIMEOUT_MS = 30_000;

/** Max bytes for CLI result paging. */
export const BRIDGE_CLI_RESULT_PAGE_BYTES = 100_000;

/** Grace period (ms) for hello_sent → ready transition (socket staying open). */
export const BRIDGE_READY_GRACE_MS = 500;

export const TOOL_DETAIL_MAX_LINES = 500;
export const TOOL_RESULT_PAGE_BYTES = 100_000;
export const TOOL_RESULT_TRUNCATE_LINES = 50;
export const TURN_SUMMARY_AUTO_COMPACT = true;
export const TURN_SUMMARY_TOOL_THRESHOLD = 1;
export const INTERACTION_MAX_OPTIONS_VISIBLE = 8;
export const INTERACTION_AUTOFOCUS_DELAY_MS = 0;
export const TAB_TITLE_MAX_CHARS = 24;
export const TAB_MIN_WIDTH_PX = 120;
export const ACTIVITY_DEBOUNCE_MS = 100;
export const STOP_REASON_BANNER_MS = 4000;
export const ABORT_CONFIRM_TIMEOUT_MS = 2500;
export const VAULT_PREFS_JSON_INDENT = 2;
export const SLASH_MENU_MAX_SUGGESTIONS = 8;
