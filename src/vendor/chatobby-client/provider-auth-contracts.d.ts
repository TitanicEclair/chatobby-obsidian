/** Ephemeral Settings interaction only. Never persist this state in a session or plugin settings. */
export type ProviderLoginMethod = "browser" | "device_code";
export interface ProviderAuthentication {
    apiKey: boolean;
    subscription?: {
        label: string;
        methods: ProviderLoginMethod[];
    };
    connectedWith?: "api_key" | "oauth";
}
export interface ProviderLoginState {
    loginId: string;
    provider: string;
    status: "pending" | "connected" | "cancelled" | "failed";
    message: string;
    url?: string;
    userCode?: string;
    prompt?: {
        id: string;
        message: string;
        placeholder?: string;
        allowEmpty: boolean;
    };
}
export declare function parseProviderLoginState(value: unknown): ProviderLoginState;
