import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../vendor/chatobby-client/ws-client.js";
import type {
  PreparedRuntimeLease,
  RuntimeInstancePaths,
  RuntimeLeaseCandidate,
} from "../contracts";
import { RuntimeReadyDescriptorStore } from "./ready-descriptor-store";

export interface LegacyRuntimeShutdownTarget {
  descriptor: { host: "127.0.0.1"; port: number };
  controlToken: string;
}

/** Persist scoped credentials beside the machine-local vault runtime descriptor. */
export class RuntimeLeaseStore {
  private readonly descriptors: RuntimeReadyDescriptorStore;

  constructor(descriptors = new RuntimeReadyDescriptorStore()) {
    this.descriptors = descriptors;
  }

  pathsForVault(vaultId: string): RuntimeInstancePaths {
    const base = process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Chatobby", "runtimes")
      : join(process.env.XDG_RUNTIME_DIR ?? homedir(), ".chatobby", "runtimes");
    const directory = join(base, vaultId);
    return {
      directory,
      descriptorFile: join(directory, "ready.json"),
      controlTokenFile: join(directory, "control.token"),
      sessionTokenFile: join(directory, "session.token"),
      logFile: join(directory, "runtime.log"),
    };
  }

  async readCandidate(vaultId: string): Promise<RuntimeLeaseCandidate | null> {
    const paths = this.pathsForVault(vaultId);
    const descriptor = await this.descriptors.read(paths.descriptorFile);
    if (!descriptor || descriptor.vaultId !== vaultId) return null;
    if (descriptor.protocolVersion !== CHATOBBY_RUNTIME_PROTOCOL_VERSION) return null;
    try {
      const [controlToken, sessionToken] = await Promise.all([
        readFile(paths.controlTokenFile, "utf8"),
        readFile(paths.sessionTokenFile, "utf8"),
      ]);
      const normalizedControl = controlToken.trim();
      const normalizedSession = sessionToken.trim();
      if (fingerprint(normalizedControl) !== descriptor.controlTokenFingerprint) return null;
      if (fingerprint(normalizedSession) !== descriptor.sessionTokenFingerprint) return null;
      return { descriptor, controlToken: normalizedControl, sessionToken: normalizedSession, paths };
    } catch {
      return null;
    }
  }

  async readLegacyShutdownTarget(vaultId: string): Promise<LegacyRuntimeShutdownTarget | null> {
    const paths = this.pathsForVault(vaultId);
    const descriptor = await this.descriptors.readLegacyForShutdown(paths.descriptorFile);
    if (!descriptor || descriptor.vaultId !== vaultId) return null;
    if (descriptor.protocolVersion !== CHATOBBY_RUNTIME_PROTOCOL_VERSION) return null;
    try {
      const controlToken = (await readFile(paths.controlTokenFile, "utf8")).trim();
      if (fingerprint(controlToken) !== descriptor.controlTokenFingerprint) return null;
      return {
        descriptor: { host: descriptor.host, port: descriptor.port },
        controlToken,
      };
    } catch {
      return null;
    }
  }

  async prepare(vaultId: string): Promise<PreparedRuntimeLease> {
    const paths = this.pathsForVault(vaultId);
    await mkdir(paths.directory, { recursive: true });
    const lease: PreparedRuntimeLease = {
      instanceId: randomUUID(),
      vaultId,
      controlToken: randomBytes(32).toString("base64url"),
      sessionToken: randomBytes(32).toString("base64url"),
      paths,
    };
    await Promise.all([
      writePrivateFile(paths.controlTokenFile, lease.controlToken),
      writePrivateFile(paths.sessionTokenFile, lease.sessionToken),
    ]);
    return lease;
  }

  async discardStaleDescriptor(vaultId: string): Promise<void> {
    await this.descriptors.remove(this.pathsForVault(vaultId).descriptorFile);
  }

  async readDescriptor(path: string) {
    return this.descriptors.read(path);
  }
}

export function deriveRuntimeVaultId(vaultRoot: string): string {
  return `vault-${createHash("sha256").update(resolve(vaultRoot)).digest("hex").slice(0, 24)}`;
}

export function runtimeDisplayName(vaultRoot: string): string {
  return basename(vaultRoot) || vaultRoot;
}

function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function writePrivateFile(path: string, value: string): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${value}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
}
