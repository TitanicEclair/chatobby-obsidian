import { request as httpRequest } from "node:http";
import type {
  RuntimeIdentity,
  RuntimeMaintenanceActiveWorkKind,
  RuntimeMaintenanceAdmission,
  RuntimeMaintenanceAdmitRequest,
  RuntimeMaintenanceLeaseRequest,
  RuntimeMaintenanceLeaseResult,
  RuntimeReadyDescriptor,
  RuntimeStatusResponse,
} from "../../vendor/chatobby-client/ws-client.js";

const CONTROL_TIMEOUT_MS = 3_000;
const MAX_CONTROL_RESPONSE_BYTES = 64 * 1_024;

export interface RuntimeControlDescriptor {
  host: "127.0.0.1";
  port: number;
}

/** Authenticated, loopback-only client for the runtime lifecycle control plane. */
export class RuntimeControlClient {
  async status(descriptor: RuntimeReadyDescriptor, controlToken: string): Promise<RuntimeStatusResponse> {
    const response = await this.request(descriptor, controlToken, "GET", "/api/runtime/status");
    if (!isRuntimeStatusResponse(response) || !response.ready) {
      throw new Error("Chatobby runtime did not report ready status");
    }
    if (!sameIdentity(response.identity, descriptor)) {
      throw new Error("Chatobby runtime identity does not match its ready descriptor");
    }
    return response;
  }

  async detach(descriptor: RuntimeReadyDescriptor, controlToken: string, attachmentId: string): Promise<void> {
		await this.request(descriptor, controlToken, "POST", "/api/runtime/detach", attachmentId);
  }

  async shutdown(descriptor: RuntimeControlDescriptor, controlToken: string): Promise<void> {
    await this.request(descriptor, controlToken, "POST", "/api/runtime/shutdown");
  }

  async admitMaintenance(
    descriptor: RuntimeControlDescriptor,
    controlToken: string,
    value: RuntimeMaintenanceAdmitRequest,
  ): Promise<RuntimeMaintenanceAdmission> {
    const response = await this.request(
      descriptor,
      controlToken,
      "POST",
      "/api/runtime/maintenance/admit",
      undefined,
      value,
      (status, candidate) => status === 409 && isDeferredMaintenanceAdmission(candidate, value.operationId),
    );
    if (!isMaintenanceAdmission(response) || response.operationId !== value.operationId) {
      throw new Error("Chatobby runtime returned an invalid maintenance admission");
    }
    return response;
  }

  async cancelMaintenance(
    descriptor: RuntimeControlDescriptor,
    controlToken: string,
    value: RuntimeMaintenanceLeaseRequest,
  ): Promise<RuntimeMaintenanceLeaseResult> {
    return this.maintenanceLeaseRequest(descriptor, controlToken, "/api/runtime/maintenance/cancel", value);
  }

  async commitMaintenance(
    descriptor: RuntimeControlDescriptor,
    controlToken: string,
    value: RuntimeMaintenanceLeaseRequest,
  ): Promise<RuntimeMaintenanceLeaseResult> {
    return this.maintenanceLeaseRequest(descriptor, controlToken, "/api/runtime/maintenance/commit", value);
  }

  private async maintenanceLeaseRequest(
    descriptor: RuntimeControlDescriptor,
    controlToken: string,
    path: string,
    value: RuntimeMaintenanceLeaseRequest,
  ): Promise<RuntimeMaintenanceLeaseResult> {
    const response = await this.request(descriptor, controlToken, "POST", path, undefined, value);
    if (!isMaintenanceLeaseResult(response)) throw new Error("Chatobby runtime returned an invalid maintenance lease result");
    return response;
  }

  private async request(
    descriptor: RuntimeControlDescriptor,
    controlToken: string,
    method: "GET" | "POST",
    path: string,
		attachmentId?: string,
		body?: unknown,
    acceptErrorResponse?: (status: number, value: unknown) => boolean,
  ): Promise<unknown> {
    return await new Promise<unknown>((resolve, reject) => {
      const request = httpRequest({
        hostname: descriptor.host,
        port: descriptor.port,
        path,
        method,
        agent: false,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${controlToken}`,
          connection: "close",
			...(attachmentId ? { "x-chatobby-attachment-id": attachmentId } : {}),
			...(body === undefined ? {} : { "content-type": "application/json" }),
        },
      }, (response) => {
        response.setEncoding("utf8");
        let body = "";
        let receivedBytes = 0;

        response.on("data", (chunk: string) => {
          receivedBytes += Buffer.byteLength(chunk);
          if (receivedBytes > MAX_CONTROL_RESPONSE_BYTES) {
            request.destroy(new Error("Chatobby runtime control response exceeded the size limit"));
            return;
          }
          body += chunk;
        });
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          const failed = status < 200 || status >= 300;
          if (failed && !acceptErrorResponse) {
            reject(new Error(`Chatobby runtime control request failed (${status})`));
            return;
          }
          try {
            const value = JSON.parse(body) as unknown;
            if (failed && !acceptErrorResponse?.(status, value)) {
              reject(new Error(`Chatobby runtime control request failed (${status})`));
              return;
            }
            resolve(value);
          } catch {
            reject(new Error("Chatobby runtime control response was not valid JSON"));
          }
        });
      });

      request.setTimeout(CONTROL_TIMEOUT_MS, () => {
        request.destroy(new Error("Chatobby runtime control request timed out"));
      });
      request.on("error", reject);
      request.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }
}

function isRuntimeStatusResponse(value: unknown): value is RuntimeStatusResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.ready === "boolean" && isRuntimeIdentity(record.identity);
}

function isRuntimeIdentity(value: unknown): value is RuntimeIdentity {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.instanceId === "string"
    && typeof record.vaultId === "string"
    && typeof record.pid === "number"
    && typeof record.startedAt === "number"
    && typeof record.runtimeVersion === "string"
    && typeof record.protocolVersion === "number"
    && (record.runtimePackageFingerprint === null
      || (typeof record.runtimePackageFingerprint === "string" && /^[a-f0-9]{64}$/.test(record.runtimePackageFingerprint)))
    && (record.developmentBuildFingerprint === undefined
      || record.developmentBuildFingerprint === null
      || (typeof record.developmentBuildFingerprint === "string" && /^[a-f0-9]{64}$/.test(record.developmentBuildFingerprint)));
}

function sameIdentity(actual: RuntimeIdentity, expected: RuntimeIdentity): boolean {
  return actual.instanceId === expected.instanceId
    && actual.vaultId === expected.vaultId
    && actual.pid === expected.pid
    && actual.startedAt === expected.startedAt
    && actual.runtimeVersion === expected.runtimeVersion
    && actual.protocolVersion === expected.protocolVersion
    && actual.runtimePackageFingerprint === expected.runtimePackageFingerprint
    && actual.developmentBuildFingerprint === expected.developmentBuildFingerprint;
}

function isMaintenanceAdmission(value: unknown): value is RuntimeMaintenanceAdmission {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || typeof record.operationId !== "string") return false;
  if (record.status === "admitted") {
    return typeof record.leaseId === "string" && typeof record.expiresAt === "number";
  }
  return record.status === "deferred"
    && typeof record.retryAfterMs === "number"
    && Array.isArray(record.activeWorkKinds)
    && record.activeWorkKinds.every((kind) => typeof kind === "string");
}

function isDeferredMaintenanceAdmission(
  value: unknown,
  operationId: string,
): value is Extract<RuntimeMaintenanceAdmission, { status: "deferred" }> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && record.status === "deferred"
    && record.operationId === operationId
    && Number.isSafeInteger(record.retryAfterMs)
    && (record.retryAfterMs as number) > 0
    && Array.isArray(record.activeWorkKinds)
    && record.activeWorkKinds.length > 0
    && record.activeWorkKinds.every(isMaintenanceActiveWorkKind);
}

function isMaintenanceActiveWorkKind(value: unknown): value is RuntimeMaintenanceActiveWorkKind {
  return value === "maintenance"
    || value === "response"
    || value === "compaction"
    || value === "queued-prompt"
    || value === "subagent"
    || value === "event";
}

function isMaintenanceLeaseResult(value: unknown): value is RuntimeMaintenanceLeaseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && typeof record.operationId === "string"
    && typeof record.leaseId === "string"
    && (record.status === "cancelled" || record.status === "committed");
}
