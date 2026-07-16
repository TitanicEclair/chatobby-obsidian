import { request as httpRequest } from "node:http";
import type {
  RuntimeIdentity,
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

  private async request(
    descriptor: RuntimeControlDescriptor,
    controlToken: string,
    method: "GET" | "POST",
    path: string,
		attachmentId?: string,
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
          if (status < 200 || status >= 300) {
            reject(new Error(`Chatobby runtime control request failed (${status})`));
            return;
          }
          try {
            resolve(JSON.parse(body) as unknown);
          } catch {
            reject(new Error("Chatobby runtime control response was not valid JSON"));
          }
        });
      });

      request.setTimeout(CONTROL_TIMEOUT_MS, () => {
        request.destroy(new Error("Chatobby runtime control request timed out"));
      });
      request.on("error", reject);
      request.end();
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
      || (typeof record.runtimePackageFingerprint === "string" && /^[a-f0-9]{64}$/.test(record.runtimePackageFingerprint)));
}

function sameIdentity(actual: RuntimeIdentity, expected: RuntimeIdentity): boolean {
  return actual.instanceId === expected.instanceId
    && actual.vaultId === expected.vaultId
    && actual.pid === expected.pid
    && actual.startedAt === expected.startedAt
    && actual.runtimeVersion === expected.runtimeVersion
    && actual.protocolVersion === expected.protocolVersion
    && actual.runtimePackageFingerprint === expected.runtimePackageFingerprint;
}
