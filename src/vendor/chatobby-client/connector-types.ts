// Generated from packages/chatobby/src/connector-types.ts. Do not edit.
/**
 * Public, data-only contracts required by the Obsidian connector.
 *
 * Product-domain screens, actions, and live state are exposed through
 * frontend-contracts.ts. Keep this file limited to connection plumbing,
 * prompting context, session-library metadata, and operator utilities that
 * cannot be represented as a frontend intent.
 */

export type AutoNameStrategy = "truncate" | "model";

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
	schemaVersion: 1;
	source: "obsidian";
	vault: string;
	workspace?: {
		workingDirectory: string;
		activeSurface: "note" | "vault";
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
	capabilities?: {
		featureFamilies: string[];
		integrations: Array<{ id: string; name: string; installed: boolean; enabled: boolean }>;
		runtimeDependencies: Array<{ id: string; name: string; available: boolean; detail?: string }>;
	};
	activeNote?: {
		path: string;
		cursor?: { line: number; ch: number };
		selection?: string;
		excerpt?: { fromLine: number; toLine: number; text: string };
		headings?: string[];
	};
	openNotes?: Array<{ path: string; title: string }>;
	privacy: {
		included: Array<
			| "workspace"
			| "environment"
			| "capabilities"
			| "active-note"
			| "selection"
			| "excerpt"
			| "headings"
			| "open-notes"
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

export interface WsExtensionUIRequest {
	id: string;
	method: "select" | "confirm" | "input" | "editor" | "notify" | "setWidget" | "setTitle";
	params: Record<string, unknown>;
}

export interface WsExtensionUIResponse {
	id: string;
	result: unknown;
}

export interface WsBridgeConfig {
	type: "bridge_config";
	url: string;
	token: string;
}

export interface WsForkMessage {
	entryId: string;
	text: string;
}
