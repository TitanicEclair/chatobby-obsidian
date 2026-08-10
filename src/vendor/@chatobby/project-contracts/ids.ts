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

export type VaultId = string & { readonly [vaultIdBrand]: true };
export type ProjectId = string & { readonly [projectIdBrand]: true };
export type RootId = string & { readonly [rootIdBrand]: true };
export type DirectoryId = string & { readonly [directoryIdBrand]: true };
export type BindingId = string & { readonly [bindingIdBrand]: true };
export type SessionId = string & { readonly [sessionIdBrand]: true };
export type ProjectReceiptId = string & { readonly [receiptIdBrand]: true };
export type ProjectCommandId = string & { readonly [commandIdBrand]: true };
export type ProjectEventId = string & { readonly [eventIdBrand]: true };
export type DeviceId = string & { readonly [deviceIdBrand]: true };
export type DirectoryCandidateRef = string & { readonly [directoryCandidateRefBrand]: true };
export type DirectoryObservationId = string & { readonly [directoryObservationIdBrand]: true };
export type RootOperationId = string & { readonly [rootOperationIdBrand]: true };
export type SessionPreflightReceiptId = string & { readonly [sessionPreflightReceiptIdBrand]: true };

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,126}[A-Za-z0-9])?$/u;

export function parseOpaqueId(value: unknown, label: string): string {
	if (typeof value !== "string" || !OPAQUE_ID_PATTERN.test(value) || value === "." || value === "..") {
		throw new ProjectContractError(
			"PROJECT_CONTRACT_INVALID",
			`${label} must be a non-empty opaque identifier without path syntax.`,
			{ retryable: false, field: label },
		);
	}
	return value;
}

export const parseVaultId = (value: unknown): VaultId => parseOpaqueId(value, "vaultId") as VaultId;
export const parseProjectId = (value: unknown): ProjectId => parseOpaqueId(value, "projectId") as ProjectId;
export const parseRootId = (value: unknown): RootId => parseOpaqueId(value, "rootId") as RootId;
export const parseDirectoryId = (value: unknown): DirectoryId => parseOpaqueId(value, "directoryId") as DirectoryId;
export const parseBindingId = (value: unknown): BindingId => parseOpaqueId(value, "bindingId") as BindingId;
export const parseSessionId = (value: unknown): SessionId => parseOpaqueId(value, "sessionId") as SessionId;
export const parseProjectReceiptId = (value: unknown): ProjectReceiptId =>
	parseOpaqueId(value, "receiptId") as ProjectReceiptId;
export const parseProjectCommandId = (value: unknown): ProjectCommandId =>
	parseOpaqueId(value, "commandId") as ProjectCommandId;
export const parseProjectEventId = (value: unknown): ProjectEventId =>
	parseOpaqueId(value, "eventId") as ProjectEventId;
export const parseDeviceId = (value: unknown): DeviceId => parseOpaqueId(value, "deviceId") as DeviceId;
export const parseDirectoryCandidateRef = (value: unknown): DirectoryCandidateRef =>
	parseOpaqueId(value, "directoryCandidateRef") as DirectoryCandidateRef;
export const parseDirectoryObservationId = (value: unknown): DirectoryObservationId =>
	parseOpaqueId(value, "observationId") as DirectoryObservationId;
export const parseRootOperationId = (value: unknown): RootOperationId =>
	parseOpaqueId(value, "operationId") as RootOperationId;
export const parseSessionPreflightReceiptId = (value: unknown): SessionPreflightReceiptId =>
	parseOpaqueId(value, "sessionPreflightReceiptId") as SessionPreflightReceiptId;

import { ProjectContractError } from "./errors.ts";
