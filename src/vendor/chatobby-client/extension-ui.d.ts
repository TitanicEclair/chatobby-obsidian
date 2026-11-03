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
export declare function isExtensionUIRequest(value: unknown): value is WsExtensionUIRequest;
/** Server dismissal is one-way; only the original interaction owns a response. */
export declare function dispatchExtensionUIRequest(request: WsExtensionUIRequest, handler: (request: WsExtensionUIRequest) => Promise<unknown>, respond: (id: string, result: unknown) => void): Promise<void>;
