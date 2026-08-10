// Generated from packages/chatobby/src/connector-types.ts. Do not edit.
/**
 * Public, data-only contracts required by the Obsidian connector.
 *
 * Product-domain screens, actions, and live state are exposed through
 * frontend-contracts.ts. Keep this file limited to connection plumbing,
 * prompting context, session-library metadata, and operator utilities that
 * cannot be represented as a frontend intent.
 */

import type { ObsidianBridgeConnectionConfig } from "@chatobby/obsidian-protocol";

export type AutoNameStrategy = "truncate" | "model";

/** Stable ID is preferred; path selection remains for active-session compatibility. */
export type WsStoredSessionSelector =
	| { readonly sessionId: string; readonly sessionPath?: never }
	| { readonly sessionPath: string; readonly sessionId?: never };

export interface WsAutoCompactionSettings {
	enabled: boolean;
	thresholdPercent: number;
	effectiveThresholdPercent: number;
}

export type WsPromptAttachment =
	| {
			type: "image";
			data: string;
			mimeType: string;
			name?: string;
			sizeBytes?: number;
	  }
	| {
			type: "file_ref";
			path: string;
			name?: string;
			mimeType?: string;
			sizeBytes?: number;
	  };

export interface WsPromptContextPacket {
	schemaVersion: 1 | 2;
	source: "obsidian";
	vault: string;
	workspace?: {
		workingDirectory: string;
		activeSurface: "note" | "view" | "vault";
		isNewSession: boolean;
		sessionMessageCount: number;
		sessionName?: string;
		permissionMode?: string;
	};
	environment?: {
		time: { sentAtUtc: string; localDate: string; localTime: string; timeZone?: string; utcOffsetMinutes: number };
		locale?: { primary?: string; languages?: string[] };
		device?: { platform?: string };
		app?: { obsidianVersion?: string; chatobbyVersion?: string };
	};
	appContext?: {
		contextId: string;
		sequence: number;
		capturedAt: string;
		revisions: { workspace: number; editor: number; page: number; capabilities: number };
		focus?: { activeLeafId?: string; viewType: string; title?: string; path?: string };
		workspace: { leafCount: number; openNoteCount: number };
		landmarks?: Array<{
			ref: string;
			role: string;
			name?: string;
			text?: string;
			href?: string;
			disabled?: boolean;
			checked?: boolean;
			expanded?: boolean;
		}>;
		inspection?: {
			leafId: string;
			documentId: string;
			documentRevision: string;
			cursor?: string;
		};
	};
	capabilities?: {
		featureFamilies: string[];
		integrations: Array<{ id: string; name: string; installed: boolean; enabled: boolean }>;
		runtimeDependencies: Array<{ id: string; name: string; available: boolean; detail?: string }>;
	};
	activeNote?: {
		path: string;
		cursor?: { line: number; ch: number };
		selection?: string;
		selectionCharacters?: number;
		selectionTruncated?: boolean;
		excerpt?: { fromLine: number; toLine: number; text: string };
		headings?: string[];
		headingCount?: number;
		headingsTruncated?: boolean;
	};
	openNotes?: Array<{ path: string; title: string }>;
	privacy: {
		included: Array<
			| "workspace"
			| "app-state"
			| "environment"
			| "capabilities"
			| "active-note"
			| "selection"
			| "excerpt"
			| "headings"
			| "open-notes"
			| "visible-landmarks"
		>;
		omitted: string[];
	};
}

export interface WsSessionInfo {
	path: string;
	id: string;
	cwd: string;
	name?: string;
	parentSessionPath?: string;
	created: string;
	modified: string;
	messageCount: number;
	firstMessage: string;
}

export interface WsSessionStats {
	sessionFile: string | undefined;
	sessionId: string;
	userMessages: number;
	assistantMessages: number;
	toolCalls: number;
	toolResults: number;
	totalMessages: number;
	tokens: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
	cost: number;
	contextUsage?: {
		tokens: number | null;
		contextWindow: number;
		percent: number | null;
	};
}

export interface WsBashResult {
	output: string;
	exitCode: number | undefined;
	cancelled: boolean;
	truncated: boolean;
	fullOutputPath?: string;
}

export interface WsAttachmentCapabilities {
	supportsImageInput: boolean;
	supportsNativeFileInput: boolean;
	supportedMimeTypes: string[];
	maxAttachmentBytes?: number;
	maxAttachmentCount?: number;
}

export interface WsRuntimeInfo {
	cwd: string;
	agentDir: string;
	attachmentDir?: string;
	vaultRoot?: string;
}

export interface WsProviderInfo {
	id: string;
	name: string;
	configured: boolean;
	authSource?: string;
	authLabel?: string;
	modelCount: number;
	availableModelCount: number;
}

export interface WsLocalModelDefinition {
	id: string;
	name: string;
	contextWindow: number;
	maxTokens: number;
	reasoning: boolean;
	imageInput: boolean;
}

export interface WsLocalModelProvider {
	id: string;
	name: string;
	preset: "ollama" | "lm-studio" | "vllm" | "llama-cpp" | "openai-compatible" | "anthropic-compatible";
	api: "openai-completions" | "openai-responses" | "anthropic-messages";
	baseUrl: string;
	authentication: "none" | "api-key" | "bearer";
	models: WsLocalModelDefinition[];
}

export interface WsLocalModelProviderDocument {
	schemaVersion: 1;
	revision: number;
	providers: WsLocalModelProvider[];
	updatedAt: string;
	containsSecretValues: false;
}

export interface WsLocalModelProviderProbeResult {
	status: "reachable" | "unreachable" | "invalid-response";
	latencyMs: number;
	advertisedModelIds: string[];
	message: string;
}

/**
 * Privileged connector-to-runtime handoff for a directory selected through the
 * host operating system. The absolute path is transient transport input; the
 * returned reference is the only value accepted by browser-facing mutations.
 */
export interface WsProjectDirectoryCandidateRequest {
	readonly schemaVersion: 1;
	readonly intentId: string;
	readonly operation: "create" | "root-add" | "root-relink";
	readonly absolutePath: string;
}

export interface WsProjectDirectoryCandidateResult {
	readonly schemaVersion: 1;
	readonly directoryCandidateRef: string;
	readonly label: string;
	readonly locationKind: "vault-relative" | "external";
	readonly vaultRelativePath?: string;
}

export interface WsExtensionUIRequest {
	id: string;
	method: "select" | "confirm" | "input" | "editor" | "notify" | "setWidget" | "setTitle";
	params: Record<string, unknown>;
}

export interface WsExtensionUIResponse {
	id: string;
	result: unknown;
}

export type WsBridgeConfig = ObsidianBridgeConnectionConfig;

export interface WsForkMessage {
	entryId: string;
	text: string;
}
