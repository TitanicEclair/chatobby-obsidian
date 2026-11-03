// Generated from packages/chatobby/src/extension-ui.ts. Do not edit.
/** A dismissal targets the original request ID and carries no new interaction. */
export interface WsExtensionUIRequest {
	id: string;
	method: "select" | "confirm" | "input" | "editor" | "notify" | "setWidget" | "setTitle" | "dismiss";
	params: Record<string, unknown>;
}

export interface WsExtensionUIResponse {
	id: string;
	result: unknown;
}

/** Validate the shared client boundary, including an unambiguous empty dismissal payload. */
export function isExtensionUIRequest(value: unknown): value is WsExtensionUIRequest {
	if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim() || !isRecord(value.params)) return false;
	if (value.method === "dismiss") return Object.keys(value.params).length === 0;
	return ["select", "confirm", "input", "editor", "notify", "setWidget", "setTitle"].includes(String(value.method));
}

/** Server dismissal is one-way; only the original interaction owns a response. */
export function dispatchExtensionUIRequest(
	request: WsExtensionUIRequest,
	handler: (request: WsExtensionUIRequest) => Promise<unknown>,
	respond: (id: string, result: unknown) => void,
): Promise<void> {
	return handler(request)
		.then((result) => {
			if (request.method !== "dismiss") respond(request.id, result);
		})
		.catch(() => {
			if (request.method !== "dismiss") respond(request.id, undefined);
		});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
