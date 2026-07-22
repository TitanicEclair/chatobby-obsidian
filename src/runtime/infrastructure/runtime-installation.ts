import { createHash, randomUUID, verify } from "node:crypto";
import { constants, createReadStream, existsSync, readFileSync } from "node:fs";
import { access, chmod, copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../vendor/chatobby-client/ws-client.js";
import type { ManagedCommand } from "../application/runtime-manager";
import type { RuntimeMode } from "../contracts";
import { runtimeInstallRoot } from "./platform-paths";

export { runtimeInstallRoot } from "./platform-paths";

export const RUNTIME_PACKAGE_MANIFEST_FILE = "runtime.manifest.json";

export interface RuntimePackageFile {
  path: string;
  size: number;
  sha256: string;
  kind: "executable" | "asset" | "notice" | "metadata";
}

export interface RuntimePackageManifest {
  schemaVersion: 2;
  version: string;
  protocolVersion: number;
  minimumPluginVersion: string;
  maximumPluginVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  executable: string;
  files: RuntimePackageFile[];
  signatureAlgorithm: "ed25519";
  signature: string;
}

export interface PendingRuntimePackageInstallation {
  executable: string;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export type RuntimePackageValidationCode =
  | "runtime_architecture_mismatch"
  | "runtime_executable_permission_invalid"
  | "runtime_package_invalid";

export class RuntimePackageValidationError extends Error {
  readonly code: RuntimePackageValidationCode;

  constructor(code: RuntimePackageValidationCode, message: string) {
    super(message);
    this.name = "RuntimePackageValidationError";
    this.code = code;
  }
}

export type ConnectorBuildMode = "development" | "release";

declare const __CHATOBBY_BUILD_MODE__: ConnectorBuildMode;
declare const __CHATOBBY_RUNTIME_PUBLIC_KEY__: string;

interface RuntimeInstallPointer {
  version: string;
  previousVersion?: string;
}

/** Resolve a development runtime or a fully verified installer-owned release package. */
export class ManagedRuntimeResolver {
  private readonly getPluginRoot: () => string | null;
  private readonly getInstallRoot: () => string;
  private readonly buildMode: ConnectorBuildMode;
  private readonly pluginVersion: string;
  private readonly trustedPublicKey: string | null;

  constructor(
    getPluginRoot: () => string | null,
    getInstallRoot: () => string = runtimeInstallRoot,
    buildMode: ConnectorBuildMode = connectorBuildMode(),
    pluginVersion = "0.0.0",
    trustedPublicKey: string | null = connectorTrustedRuntimePublicKey(),
  ) {
    this.getPluginRoot = getPluginRoot;
    this.getInstallRoot = getInstallRoot;
    this.buildMode = buildMode;
    this.pluginVersion = pluginVersion;
    this.trustedPublicKey = trustedPublicKey;
  }

  async resolve(): Promise<ManagedCommand | null> {
    if (this.buildMode === "release") {
      if (!this.trustedPublicKey) throw new Error("The release connector has no trusted Chatobby runtime public key");
      const installed = await resolveInstalledRuntime(this.getInstallRoot(), this.pluginVersion, this.trustedPublicKey);
      if (installed) {
        return {
          command: installed.executable,
          args: [],
          runtimePackageFingerprint: runtimePackageFingerprint(installed.manifest),
        };
      }
      return null;
    }
    const explicit = process.env.CHATOBBY_EXECUTABLE_PATH?.trim();
    if (explicit) return { command: explicit, args: [] };
    const pluginRoot = this.getPluginRoot();
    if (pluginRoot) {
      const bundled = join(pluginRoot, "runtime", `${process.platform}-${process.arch}`, executableName());
      if (existsSync(bundled)) return { command: bundled, args: [] };
    }
    const installed = resolveInstalledRuntimeDevelopment(this.getInstallRoot());
    if (installed) return { command: installed, args: [] };
    return { command: "chatobby", args: [] };
  }
}

/** Resolve the compile-time connector mode, defaulting tests and source runs to development. */
export function connectorBuildMode(): ConnectorBuildMode {
  return typeof __CHATOBBY_BUILD_MODE__ === "undefined" ? "development" : __CHATOBBY_BUILD_MODE__;
}

/** Release connectors may only attach to the signed installer-managed runtime. */
export function connectorRuntimeMode(configuredMode: RuntimeMode, buildMode = connectorBuildMode()): RuntimeMode {
  return buildMode === "release" ? "managed" : configuredMode;
}

/** Return the release trust anchor, or null in source/development builds. */
export function connectorTrustedRuntimePublicKey(): string | null {
  if (typeof __CHATOBBY_RUNTIME_PUBLIC_KEY__ === "undefined") return null;
  const key = __CHATOBBY_RUNTIME_PUBLIC_KEY__.trim();
  return key || null;
}

/** Verify and atomically install complete versioned runtime packages. */
export class RuntimePackageInstaller {
  private readonly installRoot: string;
  private readonly trustedPublicKey: string;
  private readonly removeDirectory: typeof rm;

  constructor(installRoot: string, trustedPublicKey: string, removeDirectory: typeof rm = rm) {
    this.installRoot = installRoot;
    this.trustedPublicKey = trustedPublicKey;
    this.removeDirectory = removeDirectory;
  }

  async install(sourceDirectory: string, manifest: RuntimePackageManifest, pluginVersion: string): Promise<string> {
    const installation = await this.prepareInstall(sourceDirectory, manifest, pluginVersion);
    await installation.commit();
    return installation.executable;
  }

  async prepareInstall(
    sourceDirectory: string,
    manifest: RuntimePackageManifest,
    pluginVersion: string,
  ): Promise<PendingRuntimePackageInstallation> {
    await verifyRuntimePackage(sourceDirectory, manifest, pluginVersion, this.trustedPublicKey, false);
    const versionsRoot = join(this.installRoot, "versions");
    const versionDirectory = join(versionsRoot, manifest.version);
    const operationId = randomUUID();
    const stagedDirectory = join(versionsRoot, `.${manifest.version}.${operationId}.staged`);
    const backupDirectory = join(versionsRoot, `.${manifest.version}.${operationId}.backup`);
    const failedDirectory = join(versionsRoot, `.${manifest.version}.${operationId}.failed`);
    await mkdir(versionsRoot, { recursive: true, mode: 0o700 });
    await setPrivateDirectoryMode(versionsRoot);
    await Promise.all([
      this.removeDirectory(stagedDirectory, { recursive: true, force: true }),
      this.removeDirectory(backupDirectory, { recursive: true, force: true }),
    ]);
    await mkdir(stagedDirectory, { recursive: true, mode: 0o700 });
    await setPrivateDirectoryMode(stagedDirectory);
    for (const file of manifest.files) {
      const destination = packagePath(stagedDirectory, file.path);
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await setPrivateDirectoryMode(dirname(destination));
      await copyFile(packagePath(sourceDirectory, file.path), destination);
      await setPrivateFileMode(destination, file.kind === "executable" ? 0o700 : 0o600);
    }
    await writeFile(join(stagedDirectory, RUNTIME_PACKAGE_MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await verifyRuntimePackage(stagedDirectory, manifest, pluginVersion, this.trustedPublicKey, true);

    const current = readPointer(this.installRoot);
    const hadExistingVersion = existsSync(versionDirectory);
    if (hadExistingVersion) await rename(versionDirectory, backupDirectory);
    try {
      await rename(stagedDirectory, versionDirectory);
    } catch (error) {
      if (hadExistingVersion && !existsSync(versionDirectory) && existsSync(backupDirectory)) {
        await rename(backupDirectory, versionDirectory);
      }
      throw error;
    }

    try {
      await writePointer(this.installRoot, {
        version: manifest.version,
        ...(current && current.version !== manifest.version ? { previousVersion: current.version } : {}),
        ...(current?.version === manifest.version && current.previousVersion
          ? { previousVersion: current.previousVersion }
          : {}),
      });
    } catch (error) {
      await this.removeDirectory(versionDirectory, { recursive: true, force: true }).catch(() => undefined);
      if (hadExistingVersion && existsSync(backupDirectory)) await rename(backupDirectory, versionDirectory);
      await restorePointer(this.installRoot, current).catch(() => undefined);
      throw error;
    }
    let settled = false;
    return {
      executable: packagePath(versionDirectory, manifest.executable),
      commit: async () => {
        if (settled) return;
        settled = true;
        if (hadExistingVersion) {
          // A successful reconnect proves the replacement can execute. Cleanup is
          // best effort because antivirus scanners may briefly retain file handles.
          await this.removeDirectory(backupDirectory, { recursive: true, force: true }).catch(() => undefined);
        }
      },
      rollback: async () => {
        if (settled) return;
        if (existsSync(versionDirectory)) await rename(versionDirectory, failedDirectory);
        try {
          if (hadExistingVersion && existsSync(backupDirectory)) await rename(backupDirectory, versionDirectory);
          await restorePointer(this.installRoot, current);
          settled = true;
        } catch (error) {
          if (!existsSync(versionDirectory) && existsSync(failedDirectory)) {
            await rename(failedDirectory, versionDirectory).catch(() => undefined);
          }
          throw error;
        }
        await this.removeDirectory(failedDirectory, { recursive: true, force: true }).catch(() => undefined);
      },
    };
  }

  async rollback(pluginVersion: string): Promise<string> {
    const current = readPointer(this.installRoot);
    if (!current?.previousVersion) throw new Error("No previous Chatobby runtime is available");
    const versionDirectory = join(this.installRoot, "versions", current.previousVersion);
    const manifest = await readRuntimePackageManifest(versionDirectory);
    await verifyRuntimePackage(versionDirectory, manifest, pluginVersion, this.trustedPublicKey, true);
    await writePointer(this.installRoot, { version: current.previousVersion, previousVersion: current.version });
    return packagePath(versionDirectory, manifest.executable);
  }

  async removeVersion(version: string): Promise<void> {
    const current = readPointer(this.installRoot);
    if (current?.version === version) throw new Error("Cannot remove the active Chatobby runtime");
    await rm(join(this.installRoot, "versions", version), { recursive: true, force: true });
  }
}

async function resolveInstalledRuntime(
  root: string,
  pluginVersion: string,
  trustedPublicKey: string,
): Promise<{ executable: string; manifest: RuntimePackageManifest } | null> {
  const pointer = readPointer(root);
  if (!pointer) return null;
  const versionDirectory = join(root, "versions", pointer.version);
  const manifest = await readRuntimePackageManifest(versionDirectory);
  await verifyRuntimePackage(versionDirectory, manifest, pluginVersion, trustedPublicKey, true);
  if (manifest.version !== pointer.version) throw new Error("Runtime pointer and package version do not match");
  return { executable: packagePath(versionDirectory, manifest.executable), manifest };
}

function resolveInstalledRuntimeDevelopment(root: string): string | null {
  const pointer = readPointer(root);
  if (!pointer) return null;
  const executable = join(root, "versions", pointer.version, executableName());
  return existsSync(executable) ? executable : null;
}

export async function readRuntimePackageManifest(versionDirectory: string): Promise<RuntimePackageManifest> {
  try {
    const value: unknown = JSON.parse(await readFile(join(versionDirectory, RUNTIME_PACKAGE_MANIFEST_FILE), "utf8"));
    if (!isRuntimePackageManifest(value)) throw new Error("manifest shape is invalid");
    return value;
  } catch (error) {
    throw new Error(`Installed Chatobby runtime manifest is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Read the active package pointer for update comparison without launching it. */
export function readInstalledRuntimeVersion(root = runtimeInstallRoot()): string | null {
  return readPointer(root)?.version ?? null;
}

export async function verifyRuntimePackage(
  root: string,
  manifest: RuntimePackageManifest,
  pluginVersion: string,
  trustedPublicKey: string,
  requireExecutableAccess = true,
): Promise<void> {
  validateManifestTarget(manifest, pluginVersion);
  if (
    !verify(
      null,
      Buffer.from(runtimePackageSigningPayload(manifest), "utf8"),
      trustedPublicKey,
      Buffer.from(manifest.signature, "base64"),
    )
  ) {
    throw new RuntimePackageValidationError("runtime_package_invalid", "Runtime package signature is invalid");
  }
  const packagedPaths = (await runtimePackageFiles(root))
    .filter((path) => path !== RUNTIME_PACKAGE_MANIFEST_FILE)
    .sort();
  const inventoriedPaths = manifest.files.map((file) => file.path).sort();
  if (JSON.stringify(packagedPaths) !== JSON.stringify(inventoriedPaths)) {
    throw new Error("Runtime manifest does not inventory the complete package");
  }
  for (const file of manifest.files) {
    const path = packagePath(root, file.path);
    let info: Awaited<ReturnType<typeof lstat>>;
    try {
      info = await lstat(path);
    } catch {
      throw new Error(`Runtime package file is missing: ${file.path}`);
    }
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Runtime package file is not regular: ${file.path}`);
    if (info.size !== file.size) throw new Error(`Runtime package file size mismatch: ${file.path}`);
    const digest = await sha256File(path);
    if (digest !== file.sha256) throw new Error(`Runtime package checksum mismatch: ${file.path}`);
  }
  if (requireExecutableAccess) await verifyExecutableAccess(packagePath(root, manifest.executable));
}

function validateManifestTarget(manifest: RuntimePackageManifest, pluginVersion: string): void {
  if (manifest.schemaVersion !== 2 || manifest.signatureAlgorithm !== "ed25519") {
    throw new Error("Runtime package manifest is unsupported");
  }
  if (manifest.platform !== process.platform || manifest.arch !== process.arch) {
    throw new RuntimePackageValidationError(
      "runtime_architecture_mismatch",
      `Runtime package targets ${manifest.platform}-${manifest.arch}, expected ${process.platform}-${process.arch}`,
    );
  }
  if (manifest.protocolVersion !== CHATOBBY_RUNTIME_PROTOCOL_VERSION) {
    throw new Error(
      `Runtime package protocol ${manifest.protocolVersion} is incompatible with protocol ${CHATOBBY_RUNTIME_PROTOCOL_VERSION}`,
    );
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(manifest.version)) {
    throw new Error("Runtime package version is invalid");
  }
  if (!isCompatiblePluginVersion(pluginVersion, manifest.minimumPluginVersion, manifest.maximumPluginVersion)) {
    throw new Error(
      `Runtime package supports plugin ${manifest.minimumPluginVersion} through ${manifest.maximumPluginVersion}, not ${pluginVersion}`,
    );
  }
  const paths = manifest.files.map((file) => file.path);
  if (paths.length === 0 || new Set(paths).size !== paths.length) throw new Error("Runtime package file inventory is invalid");
  if (JSON.stringify(paths) !== JSON.stringify([...paths].sort((left, right) => left.localeCompare(right)))) {
    throw new Error("Runtime package file inventory must be sorted");
  }
  for (const file of manifest.files) {
    validatePackagePath(file.path);
    if (!Number.isSafeInteger(file.size) || file.size < 0) throw new Error(`Runtime package size is invalid: ${file.path}`);
    if (!/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`Runtime package checksum is invalid: ${file.path}`);
  }
  validatePackagePath(manifest.executable);
  const executable = manifest.files.filter((file) => file.path === manifest.executable && file.kind === "executable");
  if (executable.length !== 1 || manifest.executable !== executableName()) {
    throw new Error("Runtime package executable inventory is invalid");
  }
  for (const requiredPath of requiredRuntimePackageFiles()) {
    if (!paths.includes(requiredPath)) throw new Error(`Runtime package is missing required file ${requiredPath}`);
  }
}

function runtimePackageSigningPayload(manifest: RuntimePackageManifest): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    protocolVersion: manifest.protocolVersion,
    minimumPluginVersion: manifest.minimumPluginVersion,
    maximumPluginVersion: manifest.maximumPluginVersion,
    platform: manifest.platform,
    arch: manifest.arch,
    executable: manifest.executable,
    files: manifest.files.map((file) => ({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
      kind: file.kind,
    })),
  });
}

function runtimePackageFingerprint(manifest: RuntimePackageManifest): string {
  return createHash("sha256").update(runtimePackageSigningPayload(manifest)).digest("hex");
}

function requiredRuntimePackageFiles(): string[] {
  return [
    executableName(),
    "assets/app-bridge.bundle.js",
    "assets/photon_rs_bg.wasm",
    "assets/tree-sitter-bash.wasm",
    "assets/web-tree-sitter.wasm",
    "build-provenance.json",
    "checksums.txt",
    "release-descriptor.json",
    "sbom.spdx.json",
    "THIRD_PARTY_NOTICES.txt",
  ];
}

async function runtimePackageFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Runtime package contains a symbolic link: ${relative(root, path)}`);
      }
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(relative(root, path).split(sep).join("/"));
    }
  };
  await visit(root);
  return files;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path) as AsyncIterable<unknown>) {
    if (!(chunk instanceof Uint8Array)) throw new Error("Runtime package hash stream returned invalid data");
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function verifyExecutableAccess(path: string): Promise<void> {
  if (process.platform === "win32") return;
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("not a regular file");
    await access(path, constants.X_OK);
  } catch {
    throw new RuntimePackageValidationError(
      "runtime_executable_permission_invalid",
      "Runtime executable is not a regular executable file",
    );
  }
}

async function setPrivateDirectoryMode(path: string): Promise<void> {
  if (process.platform !== "win32") await chmod(path, 0o700);
}

async function setPrivateFileMode(path: string, mode: number): Promise<void> {
  if (process.platform !== "win32") await chmod(path, mode);
}

function packagePath(root: string, path: string): string {
  validatePackagePath(path);
  return join(root, ...path.split("/"));
}

function validatePackagePath(path: string): void {
  const segments = path.split("/");
  if (!path || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    throw new Error(`Runtime package path is invalid: ${path}`);
  }
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Runtime package path is invalid: ${path}`);
  }
  if (path === RUNTIME_PACKAGE_MANIFEST_FILE) throw new Error("Runtime package manifest cannot inventory itself");
}

function readPointer(root: string): RuntimeInstallPointer | null {
  try {
    const value: unknown = JSON.parse(readFileSync(join(root, "current.json"), "utf8"));
    if (!isRecord(value) || typeof value.version !== "string") return null;
    return {
      version: value.version,
      ...(typeof value.previousVersion === "string" ? { previousVersion: value.previousVersion } : {}),
    };
  } catch {
    return null;
  }
}

async function writePointer(root: string, pointer: RuntimeInstallPointer): Promise<void> {
  const path = join(root, "current.json");
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(pointer, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

async function restorePointer(root: string, pointer: RuntimeInstallPointer | null): Promise<void> {
  if (pointer) {
    await writePointer(root, pointer);
    return;
  }
  await rm(join(root, "current.json"), { force: true });
}

function isCompatiblePluginVersion(version: string, minimum: string, maximum: string): boolean {
  const actual = parseVersion(version);
  const lower = parseVersion(minimum);
  const upper = maximum.endsWith(".x") ? parseVersion(`${maximum.slice(0, -2)}.999999`) : parseVersion(maximum);
  if (!actual || !lower || !upper) return false;
  return compareVersions(actual, lower) >= 0 && compareVersions(actual, upper) <= 0;
}

function parseVersion(value: string): readonly [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function executableName(): string {
  return process.platform === "win32" ? "chatobby.exe" : "chatobby";
}

function isRuntimePackageManifest(value: unknown): value is RuntimePackageManifest {
  if (!isRecord(value) || !Array.isArray(value.files)) return false;
  return value.schemaVersion === 2
    && typeof value.version === "string"
    && typeof value.protocolVersion === "number"
    && typeof value.minimumPluginVersion === "string"
    && typeof value.maximumPluginVersion === "string"
    && typeof value.platform === "string"
    && typeof value.arch === "string"
    && typeof value.executable === "string"
    && value.signatureAlgorithm === "ed25519"
    && typeof value.signature === "string"
    && value.files.every(isRuntimePackageFile);
}

function isRuntimePackageFile(value: unknown): value is RuntimePackageFile {
  return isRecord(value)
    && typeof value.path === "string"
    && typeof value.size === "number"
    && typeof value.sha256 === "string"
    && (
      value.kind === "executable"
      || value.kind === "asset"
      || value.kind === "notice"
      || value.kind === "metadata"
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
