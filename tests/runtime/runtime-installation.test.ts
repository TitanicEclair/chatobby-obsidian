import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeUpdateManager } from "../../src/runtime/public";
import {
  connectorRuntimeMode,
  ManagedRuntimeResolver,
  PENDING_RUNTIME_INSTALLATION_FILE,
  RUNTIME_INSTALLATION_LOCK_DIRECTORY,
  RUNTIME_PACKAGE_MANIFEST_FILE,
  RuntimePackageInstaller,
  type RuntimePackageFile,
  type RuntimePackageManifest,
} from "../../src/runtime/infrastructure/runtime-installation";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("runtime installation", () => {
  it("forces release builds onto the signed managed runtime", () => {
    expect(connectorRuntimeMode("developer", "release")).toBe("managed");
    expect(connectorRuntimeMode("external", "release")).toBe("managed");
    expect(connectorRuntimeMode("developer", "development")).toBe("developer");
  });

  it("prefers a platform-specific runtime bundled with the plugin in development", async () => {
    const pluginRoot = await temporaryDirectory();
    const installRoot = await temporaryDirectory();
    const executable = join(pluginRoot, "runtime", `${process.platform}-${process.arch}`, executableName());
    const installed = join(installRoot, "versions", "0.1.0", executableName());
    await mkdir(join(executable, ".."), { recursive: true });
    await mkdir(join(installed, ".."), { recursive: true });
    await writeFile(executable, "runtime");
    await writeFile(installed, "installed runtime");
    await writeFile(join(installRoot, "current.json"), JSON.stringify({ version: "0.1.0" }));

    await expect(new ManagedRuntimeResolver(() => pluginRoot, () => installRoot).resolve())
      .resolves.toEqual({ command: executable, args: [] });
  });

  it("uses the machine-local runtime without release verification in development", async () => {
    const pluginRoot = await temporaryDirectory();
    const installRoot = await temporaryDirectory();
    const executable = join(installRoot, "versions", "0.1.0", executableName());
    await mkdir(join(executable, ".."), { recursive: true });
    await writeFile(executable, "installed runtime");
    await writeFile(join(installRoot, "current.json"), JSON.stringify({ version: "0.1.0" }));

    await expect(new ManagedRuntimeResolver(() => pluginRoot, () => installRoot).resolve()).resolves.toEqual({
      command: executable,
      args: [],
    });
  });

  it("resolves only a fully signed installer-managed package in release mode", async () => {
    const pluginRoot = await temporaryDirectory();
    const installRoot = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const versionDirectory = join(installRoot, "versions", "0.1.0");
    const manifest = await writeRuntimePackage(versionDirectory, "0.1.0", "installed runtime", keys.privateKey);
    await writeManifest(versionDirectory, manifest);
    await writeFile(join(installRoot, "current.json"), JSON.stringify({ version: "0.1.0" }));

    await expect(
      new ManagedRuntimeResolver(
        () => pluginRoot,
        () => installRoot,
        "release",
        "0.1.0",
        publicKeyPem(keys.publicKey),
      ).resolve(),
    ).resolves.toEqual({
      command: join(versionDirectory, executableName()),
      args: [],
      runtimePackageFingerprint: packageFingerprint(manifest),
    });
  });

  it("fails closed when a release package is tampered after installation", async () => {
    const installRoot = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const versionDirectory = join(installRoot, "versions", "0.1.0");
    const manifest = await writeRuntimePackage(versionDirectory, "0.1.0", "runtime", keys.privateKey);
    await writeManifest(versionDirectory, manifest);
    await writeFile(join(installRoot, "current.json"), JSON.stringify({ version: "0.1.0" }));
    await writeFile(join(versionDirectory, executableName()), "tampered");

    await expect(
      new ManagedRuntimeResolver(
        () => null,
        () => installRoot,
        "release",
        "0.1.0",
        publicKeyPem(keys.publicKey),
      ).resolve(),
    ).rejects.toThrow(/size mismatch|checksum mismatch/);
  });

  it("fails closed when a release build has no trust anchor", async () => {
    const installRoot = await temporaryDirectory();
    await expect(new ManagedRuntimeResolver(() => null, () => installRoot, "release", "0.1.0", null).resolve())
      .rejects.toThrow("no trusted Chatobby runtime public key");
  });

  it("reports an absent release runtime without treating it as a corrupt package", async () => {
    const installRoot = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");

    await expect(new ManagedRuntimeResolver(
      () => null,
      () => installRoot,
      "release",
      "0.1.0",
      publicKeyPem(keys.publicKey),
    ).resolve()).resolves.toBeNull();
  });

  it("installs complete signed packages and atomically rolls the pointer back", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));
    const firstManifest = await writeRuntimePackage(source, "1.0.0", "runtime-v1", keys.privateKey);
    const first = await installer.install(source, firstManifest, "0.1.0");

    const secondManifest = await writeRuntimePackage(source, "1.1.0", "runtime-v2", keys.privateKey);
    const second = await installer.install(source, secondManifest, "0.1.0");
    const rolledBack = await installer.rollback("0.1.0");

    expect(first).toContain(join("versions", "1.0.0"));
    expect(second).toContain(join("versions", "1.1.0"));
    expect(rolledBack).toContain(join("versions", "1.0.0"));
  });

  it("verifies the complete active package before reporting its installed version", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", keys.privateKey);
    await installer.install(source, manifest, "0.1.0");

    await expect(installer.readVerifiedInstalledVersion("0.1.0")).resolves.toBe("1.0.0");
    await writeFile(join(installRoot, "versions", "1.0.0", executableName()), "tampered");
    await expect(installer.readVerifiedInstalledVersion("0.1.0")).rejects.toThrow(/size mismatch|checksum mismatch/u);
  });

  it("serializes account-local installation mutations with an exclusive lock", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", keys.privateKey);
    await mkdir(join(installRoot, RUNTIME_INSTALLATION_LOCK_DIRECTORY));

    await expect(installer.prepareInstall(source, manifest, "0.1.0")).rejects.toThrow(
      "Another Chatobby vault is currently changing",
    );
  });

  it("reclaims a lock whose recorded installation process has exited", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", keys.privateKey);
    const lockDirectory = join(installRoot, RUNTIME_INSTALLATION_LOCK_DIRECTORY);
    await mkdir(lockDirectory);
    await writeFile(join(lockDirectory, "owner.json"), JSON.stringify({
      schemaVersion: 1,
      pid: 999_999,
      operationId: "stale",
      acquiredAt: "2000-01-01T00:00:00.000Z",
      containsSecretValues: false,
    }));

    const pending = await installer.prepareInstall(source, manifest, "0.1.0");
    await pending.rollback();

    expect(existsSync(lockDirectory)).toBe(false);
  });

  it("removes only connector-owned runtime program state", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", keys.privateKey);
    await installer.install(source, manifest, "0.1.0");
    await writeFile(join(installRoot, "operator-note.txt"), "preserve");

    await expect(installer.removeInstalledRuntime()).rejects.toThrow("unowned entries");
    await rm(join(installRoot, "operator-note.txt"));
    await installer.removeInstalledRuntime();

    expect(existsSync(join(installRoot, "current.json"))).toBe(false);
    expect(existsSync(join(installRoot, "versions"))).toBe(false);
  });

  it("reclaims only exact orphaned operation directories before staging a retry", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const publicKey = publicKeyPem(keys.publicKey);
    const installer = new RuntimePackageInstaller(installRoot, publicKey);
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", keys.privateKey);
    const versionsRoot = join(installRoot, "versions");
    const orphan = join(
      versionsRoot,
      ".0.3.1.11111111-1111-4111-8111-111111111111.staged",
    );
    const unrelated = join(versionsRoot, ".0.3.1.operator-note.staged");
    await mkdir(orphan, { recursive: true });
    await mkdir(unrelated, { recursive: true });
    await writeFile(join(orphan, "partial-runtime"), "partial");

    await installer.install(source, manifest, "0.1.0");

    expect(existsSync(orphan)).toBe(false);
    expect(existsSync(unrelated)).toBe(true);
  });

  it.runIf(process.platform !== "win32")("assigns private fixed modes instead of trusting source modes", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", keys.privateKey);
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));

    const executable = await installer.install(source, manifest, "0.1.0");
    const versionRoot = join(installRoot, "versions", "1.0.0");

    expect((await stat(versionRoot)).mode & 0o777).toBe(0o700);
    expect((await stat(executable)).mode & 0o777).toBe(0o700);
    expect((await stat(join(versionRoot, "assets", "photon_rs_bg.wasm"))).mode & 0o777).toBe(0o600);
    expect((await stat(join(versionRoot, RUNTIME_PACKAGE_MANIFEST_FILE))).mode & 0o777).toBe(0o600);
  });

  it("does not report a committed same-version replacement as failed when its running backup is locked", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const installer = new RuntimePackageInstaller(
      installRoot,
      publicKeyPem(keys.publicKey),
      async (path, options) => {
        if (path.endsWith(".backup") && existsSync(path)) {
          const error = new Error("running executable is locked") as NodeJS.ErrnoException;
          error.code = "EPERM";
          throw error;
        }
        await rm(path, options);
      },
    );
    const firstManifest = await writeRuntimePackage(source, "1.0.0", "runtime-v1", keys.privateKey);
    await installer.install(source, firstManifest, "0.1.0");
    const replacementManifest = await writeRuntimePackage(source, "1.0.0", "runtime-v2", keys.privateKey);

    const replacement = await installer.install(source, replacementManifest, "0.1.0");

    expect(await readFile(replacement, "utf8")).toBe("runtime-v2");
    expect(JSON.parse(await readFile(join(installRoot, "current.json"), "utf8"))).toEqual({ version: "1.0.0" });
  });

  it("keeps a same-version repair rollback-capable until reconnection is committed", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));
    const originalManifest = await writeRuntimePackage(source, "1.0.0", "runtime-original", keys.privateKey);
    await installer.install(source, originalManifest, "0.1.0");
    const repairedManifest = await writeRuntimePackage(source, "1.0.0", "runtime-repaired", keys.privateKey);

    const pending = await installer.prepareInstall(source, repairedManifest, "0.1.0");
    expect(await readFile(pending.executable, "utf8")).toBe("runtime-repaired");

    await pending.rollback();

    expect(await readFile(pending.executable, "utf8")).toBe("runtime-original");
    expect(JSON.parse(await readFile(join(installRoot, "current.json"), "utf8"))).toEqual({ version: "1.0.0" });
  });

  it("keeps the previous version active until an authenticated candidate activates", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));
    const originalManifest = await writeRuntimePackage(source, "1.0.0", "runtime-original", keys.privateKey);
    await installer.install(source, originalManifest, "0.1.0");
    const candidateManifest = await writeRuntimePackage(source, "1.1.0", "runtime-candidate", keys.privateKey);

    const pending = await installer.prepareInstall(source, candidateManifest, "0.1.0");
    expect(JSON.parse(await readFile(join(installRoot, "current.json"), "utf8"))).toEqual({ version: "1.0.0" });

    await pending.activate();
    expect(JSON.parse(await readFile(join(installRoot, "current.json"), "utf8"))).toEqual({
      version: "1.1.0",
      previousVersion: "1.0.0",
    });

    await pending.rollback();
    expect(JSON.parse(await readFile(join(installRoot, "current.json"), "utf8"))).toEqual({ version: "1.0.0" });
  });

  it("recovers a prepared installation after plugin memory is lost", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const publicKey = publicKeyPem(keys.publicKey);
    const installer = new RuntimePackageInstaller(installRoot, publicKey);
    const original = await writeRuntimePackage(source, "1.0.0", "runtime-original", keys.privateKey);
    await installer.install(source, original, "0.1.0");
    const candidate = await writeRuntimePackage(source, "1.1.0", "runtime-candidate", keys.privateKey);

    await installer.prepareInstall(source, candidate, "0.1.0");
    expect(existsSync(join(installRoot, PENDING_RUNTIME_INSTALLATION_FILE))).toBe(true);

    const recovered = await new RuntimePackageInstaller(installRoot, publicKey).resumePendingInstall("0.1.0");
    expect(recovered?.activationState).toBe("prepared");
    await recovered?.rollback();

    expect(JSON.parse(await readFile(join(installRoot, "current.json"), "utf8"))).toEqual({ version: "1.0.0" });
    expect(existsSync(join(installRoot, PENDING_RUNTIME_INSTALLATION_FILE))).toBe(false);
    expect(existsSync(join(installRoot, "versions", "1.1.0"))).toBe(false);
  });

  it("finalizes the exact activated repair after plugin memory is lost", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const publicKey = publicKeyPem(keys.publicKey);
    const installer = new RuntimePackageInstaller(installRoot, publicKey);
    const original = await writeRuntimePackage(source, "1.0.0", "runtime-original", keys.privateKey);
    await installer.install(source, original, "0.1.0");
    const repaired = await writeRuntimePackage(source, "1.0.0", "runtime-repaired", keys.privateKey);
    const pending = await installer.prepareInstall(source, repaired, "0.1.0");
    await pending.activate();

    const recovered = await new RuntimePackageInstaller(installRoot, publicKey).resumePendingInstall("0.1.0");
    expect(recovered?.activationState).toBe("activated");
    expect(recovered?.runtimePackageFingerprint).toBe(packageFingerprint(repaired));
    await recovered?.finalize();

    expect(await readFile(join(installRoot, "versions", "1.0.0", executableName()), "utf8")).toBe("runtime-repaired");
    expect(existsSync(join(installRoot, PENDING_RUNTIME_INSTALLATION_FILE))).toBe(false);
    expect((await readdir(join(installRoot, "versions"))).some((entry) => entry.endsWith(".backup"))).toBe(false);
  });

  it("joins concurrent restored tabs when finalizing a signed recovered repair", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const publicKey = publicKeyPem(keys.publicKey);
    const installer = new RuntimePackageInstaller(installRoot, publicKey);
    const original = await writeRuntimePackage(source, "1.0.0", "runtime-original", keys.privateKey);
    await installer.install(source, original, "0.1.0");
    const repaired = await writeRuntimePackage(source, "1.0.0", "runtime-repaired", keys.privateKey);
    const pending = await installer.prepareInstall(source, repaired, "0.1.0");
    await pending.activate();
    const recovered = await new RuntimePackageInstaller(installRoot, publicKey).resumePendingInstall("0.1.0");
    if (!recovered) throw new Error("Expected recovered repair");
    const finalize = vi.spyOn(recovered, "finalize");
    const stopRuntime = vi.fn(async () => {});
    const manager = new RuntimeUpdateManager({
      pluginVersion: "0.1.0", enabled: true,
      client: {
        fetchExact: async () => { throw new Error("Recovery must not fetch a package"); },
        stage: async () => { throw new Error("Recovery must not stage a package"); },
      },
      installer: {
        prepareInstall: installer.prepareInstall.bind(installer),
        readVerifiedInstalledVersion: installer.readVerifiedInstalledVersion.bind(installer),
        resumePendingInstall: async () => recovered,
      },
      getInstalledVersion: () => "1.0.0",
      admitMaintenance: async () => null,
      cancelMaintenance: async () => {}, commitMaintenance: async () => {},
      stopRuntime, startRuntime: async () => {},
    });
    await manager.recoverInterruptedInstallation();
    const identity = {
      instanceId: "restored-runtime", vaultId: "fixture", pid: 1, startedAt: 1,
      runtimeVersion: "1.0.0", protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
      runtimePackageFingerprint: packageFingerprint(repaired),
    };
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => manager.finalizeRecoveredRuntime(identity)));
    expect(results).toEqual(Array.from({ length: 8 }, () => ({ status: "fulfilled", value: undefined })));
    expect(finalize).toHaveBeenCalledOnce();
    expect(stopRuntime).not.toHaveBeenCalled();
    expect(await readFile(pending.executable, "utf8")).toBe("runtime-repaired");
    expect(existsSync(join(installRoot, PENDING_RUNTIME_INSTALLATION_FILE))).toBe(false);
    expect((await readdir(join(installRoot, "versions"))).some((entry) => entry.endsWith(".backup"))).toBe(false);
  });

  it.each(["intact", "partial", "removed"] as const)(
    "resumes accepted cleanup after interruption leaves the backup %s",
    async (remaining) => {
      const installRoot = await temporaryDirectory();
      const source = await temporaryDirectory();
      const keys = generateKeyPairSync("ed25519");
      const publicKey = publicKeyPem(keys.publicKey);
      const journalPath = join(installRoot, PENDING_RUNTIME_INSTALLATION_FILE);
      const installer = new RuntimePackageInstaller(installRoot, publicKey, async (path, options) => {
        if (path.endsWith(".backup") && existsSync(path)) {
          if (remaining === "partial") await rm(join(path, RUNTIME_PACKAGE_MANIFEST_FILE));
          if (remaining === "removed") await rm(path, options);
          throw new Error("interrupted cleanup");
        }
        await rm(path, options);
      });
      const original = await writeRuntimePackage(source, "1.0.0", "runtime-original", keys.privateKey);
      await installer.install(source, original, "0.1.0");
      const replacement = await writeRuntimePackage(source, "1.0.0", "runtime-replacement", keys.privateKey);
      const pending = await installer.prepareInstall(source, replacement, "0.1.0");
      await pending.activate();
      await pending.finalize();

      const recovered = await new RuntimePackageInstaller(installRoot, publicKey).resumePendingInstall("0.1.0");
      expect(recovered?.activationState).toBe("activated");
      expect(JSON.parse(await readFile(journalPath, "utf8"))).toMatchObject({ schemaVersion: 2, state: "finalizing" });
      await expect(recovered?.rollback()).rejects.toThrow("cleanup has already started");
      await recovered?.activate();
      await recovered?.finalize();
      expect(existsSync(journalPath)).toBe(false);
      expect(await readFile(pending.executable, "utf8")).toBe("runtime-replacement");
      expect((await readdir(join(installRoot, "versions"))).some((name) => name.endsWith(".backup"))).toBe(false);
    },
  );

  it.each(["prepared", "activated"] as const)("recovers a legacy schema-1 %s journal", async (state) => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const publicKey = publicKeyPem(keys.publicKey);
    const installer = new RuntimePackageInstaller(installRoot, publicKey);
    const original = await writeRuntimePackage(source, "1.0.0", "runtime-original", keys.privateKey);
    await installer.install(source, original, "0.1.0");
    const replacement = await writeRuntimePackage(source, "1.0.0", "runtime-replacement", keys.privateKey);
    const pending = await installer.prepareInstall(source, replacement, "0.1.0");
    if (state === "activated") await pending.activate();
    const journalPath = join(installRoot, PENDING_RUNTIME_INSTALLATION_FILE);
    const journal: Record<string, unknown> = JSON.parse(await readFile(journalPath, "utf8"));
    await writeFile(journalPath, JSON.stringify({ ...journal, schemaVersion: 1 }));

    const recovered = await new RuntimePackageInstaller(installRoot, publicKey).resumePendingInstall("0.1.0");
    expect(recovered?.activationState).toBe(state);
    if (state === "prepared") await recovered?.rollback();
    else await recovered?.finalize();
    expect(await readFile(pending.executable, "utf8")).toBe(state === "prepared" ? "runtime-original" : "runtime-replacement");
    expect(existsSync(journalPath)).toBe(false);
  });

  it.each(["package", "pointer", "legacy-phase"] as const)(
    "rejects changed %s state when resuming accepted cleanup",
    async (changed) => {
      const installRoot = await temporaryDirectory();
      const source = await temporaryDirectory();
      const keys = generateKeyPairSync("ed25519");
      const publicKey = publicKeyPem(keys.publicKey);
      const installer = new RuntimePackageInstaller(installRoot, publicKey, async (path, options) => {
        if (path.endsWith(".backup") && existsSync(path)) throw new Error("locked backup");
        await rm(path, options);
      });
      const original = await writeRuntimePackage(source, "1.0.0", "runtime-original", keys.privateKey);
      await installer.install(source, original, "0.1.0");
      const replacement = await writeRuntimePackage(source, "1.0.0", "runtime-replacement", keys.privateKey);
      const pending = await installer.prepareInstall(source, replacement, "0.1.0");
      await pending.activate();
      await pending.finalize();
      if (changed === "package") await writeFile(pending.executable, "tampered");
      if (changed === "pointer") await writeFile(join(installRoot, "current.json"), JSON.stringify({ version: "9.0.0" }));
      if (changed === "legacy-phase") {
        const path = join(installRoot, PENDING_RUNTIME_INSTALLATION_FILE);
        const journal: Record<string, unknown> = JSON.parse(await readFile(path, "utf8"));
        await writeFile(path, JSON.stringify({ ...journal, schemaVersion: 1, state: "finalizing" }));
      }
      await expect(new RuntimePackageInstaller(installRoot, publicKey).resumePendingInstall("0.1.0"))
        .rejects.toThrow(/size mismatch|checksum mismatch|pointer has changed|journal shape is invalid/u);
    },
  );

  it("rejects a package whose signature is not trusted", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const trusted = generateKeyPairSync("ed25519");
    const untrusted = generateKeyPairSync("ed25519");
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", untrusted.privateKey);
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(trusted.publicKey));

    await expect(installer.install(source, manifest, "0.1.0")).rejects.toThrow("signature is invalid");
  });

  it("rejects incompatible protocol and plugin ranges before installation", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", keys.privateKey);
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));

    await expect(installer.install(source, { ...manifest, protocolVersion: 1 }, "0.1.0")).rejects.toThrow("protocol 1");
    await expect(installer.install(source, manifest, "0.2.0")).rejects.toThrow("not 0.2.0");
  });

  it("rejects files that are not covered by the signed package inventory", async () => {
    const installRoot = await temporaryDirectory();
    const source = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");
    const manifest = await writeRuntimePackage(source, "1.0.0", "runtime", keys.privateKey);
    await writeFile(join(source, "untracked.txt"), "not signed");
    const installer = new RuntimePackageInstaller(installRoot, publicKeyPem(keys.publicKey));

    await expect(installer.install(source, manifest, "0.1.0")).rejects.toThrow(
      "does not inventory the complete package",
    );
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "chatobby-install-"));
  directories.push(directory);
  return directory;
}

async function writeRuntimePackage(
  root: string,
  version: string,
  executableContent: string,
  privateKey: KeyObject,
): Promise<RuntimePackageManifest> {
  const contents = new Map<string, string | Buffer>([
    [executableName(), executableContent],
    ["assets/photon_rs_bg.wasm", Buffer.from([0, 97, 115, 109])],
    ["assets/tree-sitter-bash.wasm", Buffer.from([0, 97, 115, 109])],
    ["assets/web-tree-sitter.wasm", Buffer.from([0, 97, 115, 109])],
    ["build-provenance.json", "{}\n"],
    ["checksums.txt", "fixture\n"],
    ["release-descriptor.json", "{}\n"],
    ["sbom.spdx.json", "{}\n"],
    ["THIRD_PARTY_NOTICES.txt", "fixture\n"],
  ]);
  const files: RuntimePackageFile[] = [];
  await rm(root, { recursive: true, force: true });
  for (const [path, content] of contents) {
    const filePath = join(root, ...path.split("/"));
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, bytes);
    if (path === executableName() && process.platform !== "win32") await chmod(filePath, 0o700);
    files.push({
      path,
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      kind: path === executableName()
        ? "executable"
        : path.startsWith("assets/")
          ? "asset"
          : path === "THIRD_PARTY_NOTICES.txt"
            ? "notice"
            : "metadata",
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const unsigned = {
    schemaVersion: 2 as const,
    version,
    protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
    minimumPluginVersion: "0.1.0",
    maximumPluginVersion: "0.1.x",
    platform: process.platform,
    arch: process.arch,
    executable: executableName(),
    files,
  };
  return {
    ...unsigned,
    signatureAlgorithm: "ed25519",
    signature: sign(null, Buffer.from(signingPayload(unsigned), "utf8"), privateKey).toString("base64"),
  };
}

async function writeManifest(root: string, manifest: RuntimePackageManifest): Promise<void> {
  await writeFile(join(root, RUNTIME_PACKAGE_MANIFEST_FILE), JSON.stringify(manifest));
}

function signingPayload(manifest: Omit<RuntimePackageManifest, "signatureAlgorithm" | "signature">): string {
  return JSON.stringify(manifest);
}

function packageFingerprint(manifest: RuntimePackageManifest): string {
  const { signatureAlgorithm: _signatureAlgorithm, signature: _signature, ...unsigned } = manifest;
  return createHash("sha256").update(signingPayload(unsigned)).digest("hex");
}

function publicKeyPem(publicKey: KeyObject): string {
  return publicKey.export({ type: "spki", format: "pem" }).toString();
}

function executableName(): string {
  return process.platform === "win32" ? "chatobby.exe" : "chatobby";
}
