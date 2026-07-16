import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RuntimeLeaseStore } from "../../src/runtime/infrastructure/runtime-lease-store";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

const originalLocalAppData = process.env.LOCALAPPDATA;
const directories: string[] = [];

afterEach(async () => {
  if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = originalLocalAppData;
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("RuntimeLeaseStore legacy upgrade cleanup", () => {
  it("returns a schema-v1 descriptor only as an authenticated shutdown target", async () => {
    const localAppData = await mkdtemp(join(tmpdir(), "chatobby-legacy-runtime-"));
    directories.push(localAppData);
    process.env.LOCALAPPDATA = localAppData;
    const store = new RuntimeLeaseStore();
    const vaultId = "vault-legacy";
    const paths = store.pathsForVault(vaultId);
    const controlToken = "legacy-control-token";
    await mkdir(paths.directory, { recursive: true });
    await writeFile(paths.controlTokenFile, controlToken);
    await writeFile(paths.descriptorFile, JSON.stringify({
      schemaVersion: 1,
      instanceId: "legacy-instance",
      vaultId,
      pid: 1234,
      startedAt: 1_700_000_000_000,
      runtimeVersion: "0.1.0-development",
      protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
      host: "127.0.0.1",
      port: 43124,
      controlTokenFingerprint: createHash("sha256").update(controlToken).digest("hex"),
      sessionTokenFingerprint: "b".repeat(64),
    }));

    await expect(store.readCandidate(vaultId)).resolves.toBeNull();
    await expect(store.readLegacyShutdownTarget(vaultId)).resolves.toEqual({
      descriptor: { host: "127.0.0.1", port: 43124 },
      controlToken,
    });
  });
});
