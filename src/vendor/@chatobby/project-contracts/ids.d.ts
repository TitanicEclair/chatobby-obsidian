declare const vaultIdBrand: unique symbol;
declare const projectIdBrand: unique symbol;
declare const rootIdBrand: unique symbol;
declare const directoryIdBrand: unique symbol;
declare const bindingIdBrand: unique symbol;
declare const sessionIdBrand: unique symbol;
declare const receiptIdBrand: unique symbol;
declare const commandIdBrand: unique symbol;
declare const eventIdBrand: unique symbol;
declare const deviceIdBrand: unique symbol;
declare const directoryCandidateRefBrand: unique symbol;
declare const directoryObservationIdBrand: unique symbol;
declare const rootOperationIdBrand: unique symbol;
declare const sessionPreflightReceiptIdBrand: unique symbol;
export type VaultId = string & {
    readonly [vaultIdBrand]: true;
};
export type ProjectId = string & {
    readonly [projectIdBrand]: true;
};
export type RootId = string & {
    readonly [rootIdBrand]: true;
};
export type DirectoryId = string & {
    readonly [directoryIdBrand]: true;
};
export type BindingId = string & {
    readonly [bindingIdBrand]: true;
};
export type SessionId = string & {
    readonly [sessionIdBrand]: true;
};
export type ProjectReceiptId = string & {
    readonly [receiptIdBrand]: true;
};
export type ProjectCommandId = string & {
    readonly [commandIdBrand]: true;
};
export type ProjectEventId = string & {
    readonly [eventIdBrand]: true;
};
export type DeviceId = string & {
    readonly [deviceIdBrand]: true;
};
export type DirectoryCandidateRef = string & {
    readonly [directoryCandidateRefBrand]: true;
};
export type DirectoryObservationId = string & {
    readonly [directoryObservationIdBrand]: true;
};
export type RootOperationId = string & {
    readonly [rootOperationIdBrand]: true;
};
export type SessionPreflightReceiptId = string & {
    readonly [sessionPreflightReceiptIdBrand]: true;
};
export declare function parseOpaqueId(value: unknown, label: string): string;
export declare const parseVaultId: (value: unknown) => VaultId;
export declare const parseProjectId: (value: unknown) => ProjectId;
export declare const parseRootId: (value: unknown) => RootId;
export declare const parseDirectoryId: (value: unknown) => DirectoryId;
export declare const parseBindingId: (value: unknown) => BindingId;
export declare const parseSessionId: (value: unknown) => SessionId;
export declare const parseProjectReceiptId: (value: unknown) => ProjectReceiptId;
export declare const parseProjectCommandId: (value: unknown) => ProjectCommandId;
export declare const parseProjectEventId: (value: unknown) => ProjectEventId;
export declare const parseDeviceId: (value: unknown) => DeviceId;
export declare const parseDirectoryCandidateRef: (value: unknown) => DirectoryCandidateRef;
export declare const parseDirectoryObservationId: (value: unknown) => DirectoryObservationId;
export declare const parseRootOperationId: (value: unknown) => RootOperationId;
export declare const parseSessionPreflightReceiptId: (value: unknown) => SessionPreflightReceiptId;
export {};
