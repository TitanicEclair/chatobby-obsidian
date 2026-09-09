// Generated from packages/chatobby/src/provider-auth-contracts.ts. Do not edit.
/** Ephemeral Settings interaction only. Never persist this state in a session or plugin settings. */
export type ProviderLoginMethod = "browser" | "device_code";

export interface ProviderAuthentication {
	apiKey: boolean;
	subscription?: { label: string; methods: ProviderLoginMethod[] };
	connectedWith?: "api_key" | "oauth";
}

export interface ProviderLoginState {
	loginId: string;
	provider: string;
	status: "pending" | "connected" | "cancelled" | "failed";
	message: string;
	url?: string;
	userCode?: string;
	prompt?: { id: string; message: string; placeholder?: string; allowEmpty: boolean };
}

export function parseProviderLoginState(value: unknown): ProviderLoginState {
	if (!value || typeof value !== "object") throw new Error("Invalid provider sign-in response");
	const data = value as Record<string, unknown>;
	for (const key of ["loginId", "provider", "message"]) {
		if (typeof data[key] !== "string" || !data[key]) throw new Error(`Invalid sign-in ${key}`);
	}
	if (!["pending", "connected", "cancelled", "failed"].includes(String(data.status))) {
		throw new Error("Invalid sign-in status");
	}
	for (const key of ["url", "userCode"]) {
		if (data[key] !== undefined && typeof data[key] !== "string") throw new Error(`Invalid sign-in ${key}`);
	}
	if (typeof data.url === "string") {
		const url = new URL(data.url);
		if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid sign-in URL");
	}
	if (data.prompt !== undefined) {
		if (!data.prompt || typeof data.prompt !== "object") throw new Error("Invalid sign-in prompt");
		const prompt = data.prompt as Record<string, unknown>;
		if (
			typeof prompt.id !== "string" ||
			!prompt.id ||
			typeof prompt.message !== "string" ||
			typeof prompt.allowEmpty !== "boolean" ||
			(prompt.placeholder !== undefined && typeof prompt.placeholder !== "string")
		) {
			throw new Error("Invalid sign-in prompt");
		}
	}
	return value as ProviderLoginState;
}
