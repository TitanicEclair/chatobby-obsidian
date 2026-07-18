import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  connectorRuntimeMode,
  ManagedRuntimeResolver,
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

    expect(new ManagedRuntimeResolver(() => pluginRoot, () => installRoot).resolve()).toEqual({ command: executable, args: [] });
  });

  it("uses the machine-local runtime without release verification in development", async () => {
    const pluginRoot = await temporaryDirectory();
    const installRoot = await temporaryDirectory();
    const executable = join(installRoot, "versions", "0.1.0", executableName());
    await mkdir(join(executable, ".."), { recursive: true });
    await writeFile(executable, "installed runtime");
    await writeFile(join(installRoot, "current.json"), JSON.stringify({ version: "0.1.0" }));

    expect(new ManagedRuntimeResolver(() => pluginRoot, () => installRoot).resolve()).toEqual({
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

    expect(
      new ManagedRuntimeResolver(
        () => pluginRoot,
        () => installRoot,
        "release",
        "0.1.0",
        publicKeyPem(keys.publicKey),
      ).resolve(),
    ).toEqual({
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

    expect(() =>
      new ManagedRuntimeResolver(
        () => null,
        () => installRoot,
        "release",
        "0.1.0",
        publicKeyPem(keys.publicKey),
      ).resolve(),
    ).toThrow(/size mismatch|checksum mismatch/);
  });

  it("fails closed when a release build has no trust anchor", async () => {
    const installRoot = await temporaryDirectory();
    expect(() => new ManagedRuntimeResolver(() => null, () => installRoot, "release", "0.1.0", null).resolve())
      .toThrow("no trusted Chatobby runtime public key");
  });

  it("reports an absent release runtime without treating it as a corrupt package", async () => {
    const installRoot = await temporaryDirectory();
    const keys = generateKeyPairSync("ed25519");

    expect(new ManagedRuntimeResolver(
      () => null,
      () => installRoot,
      "release",
      "0.1.0",
      publicKeyPem(keys.publicKey),
    ).resolve()).toBeNull();
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
    ["assets/app-bridge.bundle.js", "bridge"],
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
