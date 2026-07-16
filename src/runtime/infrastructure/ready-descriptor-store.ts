import { readFile, rm } from "node:fs/promises";
import {
  parseRuntimeReadyDescriptor,
  type RuntimeReadyDescriptor,
} from "../../vendor/chatobby-client/ws-client.js";

export interface LegacyRuntimeControlDescriptor {
  schemaVersion: 1;
  instanceId: string;
  vaultId: string;
  protocolVersion: number;
  host: "127.0.0.1";
  port: number;
  controlTokenFingerprint: string;
}

/** Machine-local ready descriptor boundary. Invalid data is never adoptable. */
export class RuntimeReadyDescriptorStore {
  async read(path: string): Promise<RuntimeReadyDescriptor | null> {
    try {
      const value: unknown = JSON.parse(await readFile(path, "utf8"));
      return parseRuntimeReadyDescriptor(value);
    } catch {
      return null;
    }
  }

  /** Read only enough of a schema-v1 descriptor to authenticate shutdown during an upgrade. */
  async readLegacyForShutdown(path: string): Promise<LegacyRuntimeControlDescriptor | null> {
    try {
      const value: unknown = JSON.parse(await readFile(path, "utf8"));
      if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
      const record = value as Record<string, unknown>;
      if (record.schemaVersion !== 1) return null;
      if (!nonEmptyString(record.instanceId) || !nonEmptyString(record.vaultId)) return null;
      if (!positiveInteger(record.protocolVersion)) return null;
      if (record.host !== "127.0.0.1" || !port(record.port)) return null;
      if (!sha256(record.controlTokenFingerprint)) return null;
      return {
        schemaVersion: 1,
        instanceId: record.instanceId,
        vaultId: record.vaultId,
        protocolVersion: record.protocolVersion,
        host: "127.0.0.1",
        port: record.port,
        controlTokenFingerprint: record.controlTokenFingerprint,
      };
    } catch {
      return null;
    }
  }

  async removeMatching(path: string, instanceId: string): Promise<void> {
    const current = await this.read(path);
    if (!current || current.instanceId !== instanceId) return;
    await rm(path, { force: true });
  }

  async remove(path: string): Promise<void> {
    await rm(path, { force: true });
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function port(value: unknown): value is number {
  return positiveInteger(value) && value <= 65_535;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
