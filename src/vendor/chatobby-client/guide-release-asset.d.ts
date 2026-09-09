export declare const CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION: 1;
export declare const CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION: 2;
export declare const CHATOBBY_GUIDE_CHANNEL_SCHEMA_VERSION: 1;
export declare const CHATOBBY_GUIDE_CHANNEL_CONSUMER_SCHEMA_VERSION: 1;
export declare const CHATOBBY_GUIDE_ASSET_FORMAT: "chatobby-guide-file-set-v1";
export declare const CHATOBBY_GUIDE_PRODUCT: "Chatobby Guide";
export declare const CHATOBBY_GUIDE_CHANNEL_PRODUCT: "Chatobby Guide Channel";
export declare const CHATOBBY_GUIDE_CHANNEL_NAME: "stable";
export declare const CHATOBBY_GUIDE_CHANNEL_FILE: "guide-channel.json";
export declare const CHATOBBY_GUIDE_DIRECTORY: "Chatobby Guide";
export declare const CHATOBBY_GUIDE_MAX_ASSET_BYTES: number;
export declare const CHATOBBY_GUIDE_MAX_FILES = 64;
export declare const CHATOBBY_GUIDE_MAX_FILE_BYTES: number;
export declare const CHATOBBY_GUIDE_MAX_PATH_LENGTH = 180;
export interface ChatobbyGuideAssetFile {
    path: string;
    title: string;
    content: string;
}
export interface ChatobbyGuideAsset {
    schemaVersion: typeof CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION;
    product: typeof CHATOBBY_GUIDE_PRODUCT;
    productVersion: string;
    guideRevision: string;
    format: typeof CHATOBBY_GUIDE_ASSET_FORMAT;
    indexPath: string;
    title: string;
    earlyAccess: boolean;
    confirmationNotice: string;
    files: ChatobbyGuideAssetFile[];
}
/** Version-independent guide bytes accepted only through a signed compatible channel. */
export interface ChatobbyGuideChannelAsset {
    schemaVersion: typeof CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION;
    product: typeof CHATOBBY_GUIDE_PRODUCT;
    guideRevision: string;
    format: typeof CHATOBBY_GUIDE_ASSET_FORMAT;
    indexPath: string;
    title: string;
    earlyAccess: boolean;
    confirmationNotice: string;
    files: ChatobbyGuideAssetFile[];
}
export type ChatobbyGuideFileSet = ChatobbyGuideAsset | ChatobbyGuideChannelAsset;
export interface ChatobbyGuideReleaseDescriptor {
    schemaVersion: typeof CHATOBBY_GUIDE_ASSET_SCHEMA_VERSION;
    product: typeof CHATOBBY_GUIDE_PRODUCT;
    productVersion: string;
    guideRevision: string;
    format: typeof CHATOBBY_GUIDE_ASSET_FORMAT;
    file: string;
    size: number;
    sha256: string;
    fileCount: number;
}
export interface ChatobbyGuideChannelAssetDescriptor {
    schemaVersion: typeof CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION;
    product: typeof CHATOBBY_GUIDE_PRODUCT;
    guideRevision: string;
    format: typeof CHATOBBY_GUIDE_ASSET_FORMAT;
    file: string;
    size: number;
    sha256: string;
    fileCount: number;
}
export interface ChatobbyGuideChannel {
    schemaVersion: typeof CHATOBBY_GUIDE_CHANNEL_SCHEMA_VERSION;
    product: typeof CHATOBBY_GUIDE_CHANNEL_PRODUCT;
    channel: typeof CHATOBBY_GUIDE_CHANNEL_NAME;
    minimumConnectorVersion: string;
    maximumConnectorVersion: string;
    minimumConsumerSchemaVersion: number;
    maximumConsumerSchemaVersion: number;
    guide: ChatobbyGuideChannelAssetDescriptor;
    signatureAlgorithm: "ed25519";
    signature: string;
}
/** Parse the exact-version guide file set before any vault write is considered. */
export declare function parseChatobbyGuideAsset(value: unknown, expectedProductVersion: string): ChatobbyGuideAsset;
/** Parse content-addressed guide bytes without tying them to an application release. */
export declare function parseChatobbyGuideChannelAsset(value: unknown, expectedGuideRevision: string): ChatobbyGuideChannelAsset;
/** Parse the stable signed channel before checking its signature or compatibility. */
export declare function parseChatobbyGuideChannel(value: unknown): ChatobbyGuideChannel;
export declare function chatobbyGuideChannelSigningPayload(value: Omit<ChatobbyGuideChannel, "signatureAlgorithm" | "signature"> | ChatobbyGuideChannel): string;
export declare function isChatobbyGuideChannelCompatible(channel: ChatobbyGuideChannel, connectorVersion: string, consumerSchemaVersion: number): boolean;
export declare function parseChatobbyGuideReleaseDescriptor(value: unknown, expectedProductVersion: string): ChatobbyGuideReleaseDescriptor;
export declare function validateChatobbyGuidePath(path: string): string;
