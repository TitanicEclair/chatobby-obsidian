import { createHash, randomUUID, verify } from "node:crypto";
import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import { mkdir, open, rm, type FileHandle } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { get } from "node:https";
import { dirname, join } from "node:path";
import { once } from "node:events";
import { createGunzip } from "node:zlib";
import {
  CHATOBBY_RUNTIME_INDEX_URL,
  chatobbyRuntimeBundleUrl,
} from "../../publication";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../vendor/chatobby-client/ws-client.js";
import {
  readRuntimePackageManifest,
  RUNTIME_PACKAGE_MANIFEST_FILE,
  type RuntimePackageManifest,
} from "./runtime-installation";

const LEGACY_UPDATE_SCHEMA_VERSION = 1;
const UPDATE_INDEX_SCHEMA_VERSION = 2;
const BUNDLE_FORMAT = "chatobby-runtime-bundle-v1";
const BUNDLE_MAGIC = Buffer.from("CHATOBBY-RUNTIME-BUNDLE/1\n", "utf8");
const MAX_DESCRIPTOR_BYTES = 128 * 1024;
const MAX_BUNDLE_BYTES = 512 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_BUNDLE_ENTRIES = 512;
const MAX_HEADER_BYTES = 16 * 1024;
const MAX_REDIRECTS = 5;
const REQUEST_INACTIVITY_TIMEOUT_MS = 30_000;
const DESCRIPTOR_TIMEOUT_MS = 30_000;
const BUNDLE_TIMEOUT_MS = 10 * 60_000;

export interface LegacyRuntimeUpdateDescriptor {
  schemaVersion: 1;
  product: "Chatobby Runtime";
  version: string;
  protocolVersion: number;
  minimumPluginVersion: string;
  maximumPluginVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  bundle: {
    format: "chatobby-runtime-bundle-v1";
    file: string;
    size: number;
    sha256: string;
    uncompressedSize: number;
    entryCount: number;
  };
  signatureAlgorithm: "ed25519";
  signature: string;
}

export interface RuntimeReleaseTarget {
  platform: "win32" | "darwin";
  arch: "x64" | "arm64";
  bundle: LegacyRuntimeUpdateDescriptor["bundle"];
}

export interface RuntimeReleaseIndex {
  schemaVersion: 2;
  product: "Chatobby Runtime";
  version: string;
  protocolVersion: number;
  minimumPluginVersion: string;
  maximumPluginVersion: string;
  targets: RuntimeReleaseTarget[];
  signatureAlgorithm: "ed25519";
  signature: string;
}

export interface SelectedRuntimeRelease extends RuntimeReleaseIndex {
  platform: RuntimeReleaseTarget["platform"];
  arch: RuntimeReleaseTarget["arch"];
  bundle: RuntimeReleaseTarget["bundle"];
}

export type RuntimeUpdateDescriptor = LegacyRuntimeUpdateDescriptor | SelectedRuntimeRelease;

export type RuntimeTargetKey = "win32-x64" | "darwin-arm64" | "darwin-x64";

export class RuntimeUpdateError extends Error {
  readonly code: "runtime_target_unavailable" | "runtime_architecture_mismatch" | "runtime_package_invalid";

  constructor(code: RuntimeUpdateError["code"], message: string) {
    super(message);
    this.name = "RuntimeUpdateError";
    this.code = code;
  }
}

export interface RuntimeUpdateTransferProgress {
  phase: "downloading" | "extracting";
  completed: number;
  total: number;
}

export interface StagedRuntimeUpdate {
  directory: string;
  manifest: RuntimePackageManifest;
  cleanup(): Promise<void>;
}

export interface RuntimeUpdateClientLike {
  fetchLatest(pluginVersion: string, signal?: AbortSignal): Promise<RuntimeUpdateDescriptor>;
  stage(
    descriptor: RuntimeUpdateDescriptor,
    pluginVersion: string,
    signal: AbortSignal | undefined,
    progress: (progress: RuntimeUpdateTransferProgress) => void,
  ): Promise<StagedRuntimeUpdate>;
}

interface RuntimeHttpClient {
  read(url: string, maximumBytes: number, signal?: AbortSignal): Promise<Buffer>;
  download(
    url: string,
    destination: string,
    expectedSize: number,
    expectedSha256: string,
    signal: AbortSignal | undefined,
    progress: (received: number) => void,
  ): Promise<void>;
}

/** Fetch and stage signed runtime releases without executing downloaded code. */
export class RuntimeUpdateClient implements RuntimeUpdateClientLike {
  private readonly http: RuntimeHttpClient;

  constructor(
    private readonly installRoot: string,
    private readonly trustedPublicKey: string,
    http: RuntimeHttpClient = new NodeRuntimeHttpClient(),
  ) {
    this.http = http;
  }

  async fetchLatest(pluginVersion: string, signal?: AbortSignal): Promise<RuntimeUpdateDescriptor> {
    const bytes = await this.http.read(CHATOBBY_RUNTIME_INDEX_URL, MAX_DESCRIPTOR_BYTES, signal);
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new RuntimeUpdateError("runtime_package_invalid", "Chatobby's runtime update information is not valid JSON");
    }
    return verifyRuntimeUpdateDescriptor(value, pluginVersion, this.trustedPublicKey);
  }

  async stage(
    descriptor: RuntimeUpdateDescriptor,
    pluginVersion: string,
    signal: AbortSignal | undefined,
    progress: (progress: RuntimeUpdateTransferProgress) => void,
  ): Promise<StagedRuntimeUpdate> {
    const verified = verifyRuntimeUpdateDescriptor(descriptor, pluginVersion, this.trustedPublicKey);
    const operationRoot = join(this.installRoot, "updates", `${verified.version}-${randomUUID()}`);
    const archivePath = join(operationRoot, verified.bundle.file);
    const sourceDirectory = join(operationRoot, "package");
    await mkdir(operationRoot, { recursive: true });
    const cleanup = async (): Promise<void> => rm(operationRoot, { recursive: true, force: true });
    try {
      await this.http.download(
        chatobbyRuntimeBundleUrl(verified.version, verified.bundle.file),
        archivePath,
        verified.bundle.size,
        verified.bundle.sha256,
        signal,
        (received) => progress({ phase: "downloading", completed: received, total: verified.bundle.size }),
      );
      progress({ phase: "extracting", completed: 0, total: verified.bundle.uncompressedSize });
      await extractRuntimeBundle(archivePath, sourceDirectory, verified, signal, (extracted) => {
        progress({ phase: "extracting", completed: extracted, total: verified.bundle.uncompressedSize });
      });
      const manifest = await readRuntimePackageManifest(sourceDirectory);
      if (manifest.version !== verified.version || manifest.protocolVersion !== verified.protocolVersion) {
        throw new Error("Runtime update descriptor and package manifest do not match");
      }
      return { directory: sourceDirectory, manifest, cleanup };
    } catch (error) {
      await cleanup().catch(() => undefined);
      throw error;
    }
  }
}

/** Validate the signed update envelope before trusting any download metadata. */
export function verifyRuntimeUpdateDescriptor(
  value: unknown,
  pluginVersion: string,
  trustedPublicKey: string,
  target: { platform: NodeJS.Platform; arch: string } = { platform: process.platform, arch: process.arch },
): RuntimeUpdateDescriptor {
  if (isLegacyRuntimeUpdateDescriptor(value)) {
    if (value.platform !== target.platform || value.arch !== target.arch) {
      throw new RuntimeUpdateError(
        "runtime_architecture_mismatch",
        `The available runtime targets ${value.platform}-${value.arch}, not ${target.platform}-${target.arch}`,
      );
    }
    validateRuntimeCompatibility(value, pluginVersion);
    if (!verify(
      null,
      Buffer.from(runtimeUpdateSigningPayload(value), "utf8"),
      trustedPublicKey,
      Buffer.from(value.signature, "base64"),
    )) {
      throw new RuntimeUpdateError("runtime_package_invalid", "Runtime update signature is invalid");
    }
    return value;
  }

  if (!isRuntimeReleaseIndex(value)) {
    throw new RuntimeUpdateError("runtime_package_invalid", "Chatobby's runtime update information has an unsupported shape");
  }
  validateRuntimeCompatibility(value, pluginVersion);
  const targetKeys = value.targets.map(runtimeTargetKey);
  if (new Set(targetKeys).size !== targetKeys.length) {
    throw new RuntimeUpdateError("runtime_package_invalid", "Runtime release index contains duplicate targets");
  }
  if (JSON.stringify(targetKeys) !== JSON.stringify([...targetKeys].sort())) {
    throw new RuntimeUpdateError("runtime_package_invalid", "Runtime release index targets are not sorted");
  }
  if (!verify(
    null,
    Buffer.from(runtimeReleaseIndexSigningPayload(value), "utf8"),
    trustedPublicKey,
    Buffer.from(value.signature, "base64"),
  )) {
    throw new RuntimeUpdateError("runtime_package_invalid", "Runtime release index signature is invalid");
  }
  const selected = value.targets.find((candidate) => candidate.platform === target.platform && candidate.arch === target.arch);
  if (!selected) {
    throw new RuntimeUpdateError(
      "runtime_target_unavailable",
      `No Chatobby runtime is available for ${target.platform}-${target.arch}`,
    );
  }
  return { ...value, platform: selected.platform, arch: selected.arch, bundle: selected.bundle };
}

function validateRuntimeCompatibility(
  value: Pick<RuntimeUpdateDescriptor, "version" | "protocolVersion" | "minimumPluginVersion" | "maximumPluginVersion">,
  pluginVersion: string,
): void {
  if (value.protocolVersion !== CHATOBBY_RUNTIME_PROTOCOL_VERSION) {
    throw new RuntimeUpdateError(
      "runtime_package_invalid",
      `The available runtime uses unsupported protocol ${value.protocolVersion}`,
    );
  }
  if (!isCompatiblePluginVersion(pluginVersion, value.minimumPluginVersion, value.maximumPluginVersion)) {
    throw new RuntimeUpdateError(
      "runtime_package_invalid",
      `Runtime ${value.version} supports Chatobby ${value.minimumPluginVersion} through ${value.maximumPluginVersion}`,
    );
  }
}

export function compareRuntimeVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) throw new Error("Runtime update version is invalid");
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftVersion[index] ?? 0) - (rightVersion[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export async function extractRuntimeBundle(
  archivePath: string,
  destination: string,
  descriptor: RuntimeUpdateDescriptor,
  signal?: AbortSignal,
  progress: (extracted: number) => void = () => undefined,
): Promise<void> {
  await mkdir(destination, { recursive: true });
  const extractor = new RuntimeBundleExtractor(destination, descriptor, signal, progress);
  const source = createReadStream(archivePath).pipe(createGunzip());
  try {
    for await (const chunk of source as AsyncIterable<unknown>) {
      throwIfAborted(signal);
      await extractor.consume(toBuffer(chunk));
    }
    await extractor.finish();
  } catch (error) {
    source.destroy();
    await extractor.abort();
    throw error;
  }
}

class RuntimeBundleExtractor {
  private phase: "magic" | "header-size" | "header" | "file" | "complete" = "magic";
  private pending = Buffer.alloc(0);
  private headerSize = 0;
  private file: FileHandle | null = null;
  private fileRemaining = 0;
  private extracted = 0;
  private entries = 0;
  private previousPath = "";
  private sawManifest = false;

  constructor(
    private readonly destination: string,
    private readonly descriptor: RuntimeUpdateDescriptor,
    private readonly signal: AbortSignal | undefined,
    private readonly progress: (extracted: number) => void,
  ) {}

  async consume(chunk: Buffer): Promise<void> {
    let input = chunk;
    while (input.length > 0 || (this.phase !== "file" && this.pending.length > 0)) {
      throwIfAborted(this.signal);
      if (this.phase === "file") {
        const length = Math.min(input.length, this.fileRemaining);
        if (length === 0) return;
        if (!this.file) throw new Error("Runtime update bundle entry is not open");
        await writeBuffer(this.file, input.subarray(0, length));
        input = input.subarray(length);
        this.fileRemaining -= length;
        this.extracted += length;
        this.progress(this.extracted);
        if (this.fileRemaining === 0) {
          await this.file?.close();
          this.file = null;
          this.phase = "header-size";
        }
        continue;
      }
      if (input.length > 0) {
        this.pending = this.pending.length === 0 ? Buffer.from(input) : Buffer.concat([this.pending, input]);
        input = Buffer.alloc(0);
      }
      if (this.phase === "magic") {
        if (this.pending.length < BUNDLE_MAGIC.length) return;
        if (!this.pending.subarray(0, BUNDLE_MAGIC.length).equals(BUNDLE_MAGIC)) {
          throw new Error("Runtime update bundle has an invalid header");
        }
        this.pending = this.pending.subarray(BUNDLE_MAGIC.length);
        this.phase = "header-size";
      } else if (this.phase === "header-size") {
        if (this.pending.length < 4) return;
        this.headerSize = this.pending.readUInt32BE(0);
        this.pending = this.pending.subarray(4);
        if (this.headerSize === 0) {
          this.phase = "complete";
          if (this.pending.length > 0) throw new Error("Runtime update bundle has trailing data");
          return;
        }
        if (this.headerSize > MAX_HEADER_BYTES) throw new Error("Runtime update bundle entry header is too large");
        this.phase = "header";
      } else if (this.phase === "header") {
        if (this.pending.length < this.headerSize) return;
        const header = parseBundleHeader(this.pending.subarray(0, this.headerSize));
        this.pending = this.pending.subarray(this.headerSize);
        await this.openEntry(header);
        if (this.fileRemaining === 0) {
          await this.file?.close();
          this.file = null;
          this.phase = "header-size";
        } else {
          this.phase = "file";
          input = this.pending;
          this.pending = Buffer.alloc(0);
        }
      } else if (this.phase === "complete") {
        throw new Error("Runtime update bundle has trailing data");
      }
    }
  }

  async finish(): Promise<void> {
    if (this.phase !== "complete" || this.file || this.pending.length > 0) {
      throw new Error("Runtime update bundle ended before all entries were complete");
    }
    if (this.entries !== this.descriptor.bundle.entryCount) {
      throw new Error("Runtime update bundle entry count does not match its signed descriptor");
    }
    if (this.extracted !== this.descriptor.bundle.uncompressedSize) {
      throw new Error("Runtime update bundle size does not match its signed descriptor");
    }
    if (!this.sawManifest) throw new Error(`Runtime update bundle is missing ${RUNTIME_PACKAGE_MANIFEST_FILE}`);
  }

  async abort(): Promise<void> {
    await this.file?.close().catch(() => undefined);
    this.file = null;
  }

  private async openEntry(header: RuntimeBundleHeader): Promise<void> {
    validateBundlePath(header.path);
    if (this.previousPath && header.path.localeCompare(this.previousPath) <= 0) {
      throw new Error("Runtime update bundle entries are not uniquely sorted");
    }
    if (!Number.isSafeInteger(header.size) || header.size < 0) {
      throw new Error(`Runtime update bundle size is invalid: ${header.path}`);
    }
    if (this.entries >= this.descriptor.bundle.entryCount || this.entries >= MAX_BUNDLE_ENTRIES) {
      throw new Error("Runtime update bundle contains too many entries");
    }
    if (this.extracted + header.size > this.descriptor.bundle.uncompressedSize) {
      throw new Error("Runtime update bundle exceeds its signed uncompressed size");
    }
    const output = join(this.destination, ...header.path.split("/"));
    await mkdir(dirname(output), { recursive: true });
    this.file = await open(output, "wx", 0o600);
    this.fileRemaining = header.size;
    this.entries += 1;
    this.previousPath = header.path;
    this.sawManifest ||= header.path === RUNTIME_PACKAGE_MANIFEST_FILE;
  }
}

class NodeRuntimeHttpClient implements RuntimeHttpClient {
  async read(url: string, maximumBytes: number, signal?: AbortSignal): Promise<Buffer> {
    const response = await openHttpsResponse(url, signal);
    const timer = window.setTimeout(() => response.destroy(new Error("Runtime update request timed out")), DESCRIPTOR_TIMEOUT_MS);
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of response as AsyncIterable<unknown>) {
        throwIfAborted(signal);
        const bytes = toBuffer(chunk);
        size += bytes.length;
        if (size > maximumBytes) throw new Error("Runtime update response is too large");
        chunks.push(bytes);
      }
      return Buffer.concat(chunks);
    } finally {
      window.clearTimeout(timer);
      response.destroy();
    }
  }

  async download(
    url: string,
    destination: string,
    expectedSize: number,
    expectedSha256: string,
    signal: AbortSignal | undefined,
    progress: (received: number) => void,
  ): Promise<void> {
    if (expectedSize <= 0 || expectedSize > MAX_BUNDLE_BYTES) throw new Error("Runtime update download size is unsafe");
    await mkdir(dirname(destination), { recursive: true });
    const response = await openHttpsResponse(url, signal);
    const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
    const timer = window.setTimeout(() => response.destroy(new Error("Runtime update download timed out")), BUNDLE_TIMEOUT_MS);
    const hash = createHash("sha256");
    let received = 0;
    try {
      for await (const chunk of response as AsyncIterable<unknown>) {
        throwIfAborted(signal);
        const bytes = toBuffer(chunk);
        received += bytes.length;
        if (received > expectedSize) throw new Error("Runtime update download exceeds its signed size");
        hash.update(bytes);
        if (!output.write(bytes)) await once(output, "drain");
        progress(received);
      }
      await endWritable(output);
      if (received !== expectedSize) throw new Error("Runtime update download size does not match its signed descriptor");
      if (hash.digest("hex") !== expectedSha256) throw new Error("Runtime update download checksum is invalid");
    } catch (error) {
      output.destroy();
      throw error;
    } finally {
      window.clearTimeout(timer);
      response.destroy();
    }
  }
}

function openHttpsResponse(url: string, signal?: AbortSignal, redirects = 0): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const parsed = new URL(url);
    validateDownloadHost(parsed);
    const request = get(parsed, {
      headers: { "User-Agent": "Chatobby-Obsidian-Runtime-Updater" },
    });
    const abort = (): void => {
      request.destroy(abortError());
    };
    signal?.addEventListener("abort", abort, { once: true });
    request.setTimeout(REQUEST_INACTIVITY_TIMEOUT_MS, () => request.destroy(new Error("Runtime update request timed out")));
    request.once("error", reject);
    request.once("response", (response) => {
      const cleanup = (): void => signal?.removeEventListener("abort", abort);
      response.once("close", cleanup);
      const location = response.headers.location;
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location) {
        response.resume();
        cleanup();
        if (redirects >= MAX_REDIRECTS) return reject(new Error("Runtime update download redirected too many times"));
        void openHttpsResponse(new URL(location, parsed).toString(), signal, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        cleanup();
        reject(new Error(`Runtime update request failed with HTTP ${response.statusCode ?? "unknown"}`));
        return;
      }
      resolve(response);
    });
  });
}

function validateDownloadHost(url: URL): void {
  const host = url.hostname.toLowerCase();
  const githubHost = host === "github.com"
    || host === "release-assets.githubusercontent.com"
    || host.endsWith(".githubusercontent.com");
  if (url.protocol !== "https:" || !githubHost || url.username || url.password) {
    throw new Error("Runtime updates may only be downloaded securely from GitHub");
  }
}

function parseBundleHeader(bytes: Buffer): RuntimeBundleHeader {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Runtime update bundle entry header is invalid");
  }
  if (!isRecord(value) || typeof value.path !== "string" || typeof value.size !== "number") {
    throw new Error("Runtime update bundle entry header has an unsupported shape");
  }
  return { path: value.path, size: value.size };
}

interface RuntimeBundleHeader {
  path: string;
  size: number;
}

function runtimeUpdateSigningPayload(value: RuntimeUpdateDescriptor): string {
  return JSON.stringify({
    schemaVersion: value.schemaVersion,
    product: value.product,
    version: value.version,
    protocolVersion: value.protocolVersion,
    minimumPluginVersion: value.minimumPluginVersion,
    maximumPluginVersion: value.maximumPluginVersion,
    platform: value.platform,
    arch: value.arch,
    bundle: {
      format: value.bundle.format,
      file: value.bundle.file,
      size: value.bundle.size,
      sha256: value.bundle.sha256,
      uncompressedSize: value.bundle.uncompressedSize,
      entryCount: value.bundle.entryCount,
    },
  });
}

function runtimeReleaseIndexSigningPayload(value: RuntimeReleaseIndex): string {
  return JSON.stringify({
    schemaVersion: value.schemaVersion,
    product: value.product,
    version: value.version,
    protocolVersion: value.protocolVersion,
    minimumPluginVersion: value.minimumPluginVersion,
    maximumPluginVersion: value.maximumPluginVersion,
    targets: value.targets.map((target) => ({
      platform: target.platform,
      arch: target.arch,
      bundle: {
        format: target.bundle.format,
        file: target.bundle.file,
        size: target.bundle.size,
        sha256: target.bundle.sha256,
        uncompressedSize: target.bundle.uncompressedSize,
        entryCount: target.bundle.entryCount,
      },
    })),
  });
}

function isLegacyRuntimeUpdateDescriptor(value: unknown): value is LegacyRuntimeUpdateDescriptor {
  if (!isRecord(value) || !isRecord(value.bundle)) return false;
  return value.schemaVersion === LEGACY_UPDATE_SCHEMA_VERSION
    && value.product === "Chatobby Runtime"
    && typeof value.version === "string"
    && /^\d+\.\d+\.\d+$/u.test(value.version)
    && typeof value.protocolVersion === "number"
    && typeof value.minimumPluginVersion === "string"
    && typeof value.maximumPluginVersion === "string"
    && typeof value.platform === "string"
    && typeof value.arch === "string"
    && value.bundle.format === BUNDLE_FORMAT
    && typeof value.bundle.file === "string"
    && /^[A-Za-z0-9._-]+\.cbr\.gz$/u.test(value.bundle.file)
    && typeof value.bundle.size === "number"
    && Number.isSafeInteger(value.bundle.size)
    && value.bundle.size > 0
    && value.bundle.size <= MAX_BUNDLE_BYTES
    && typeof value.bundle.sha256 === "string"
    && /^[a-f0-9]{64}$/u.test(value.bundle.sha256)
    && typeof value.bundle.uncompressedSize === "number"
    && Number.isSafeInteger(value.bundle.uncompressedSize)
    && value.bundle.uncompressedSize > 0
    && value.bundle.uncompressedSize <= MAX_UNCOMPRESSED_BYTES
    && typeof value.bundle.entryCount === "number"
    && Number.isSafeInteger(value.bundle.entryCount)
    && value.bundle.entryCount > 0
    && value.bundle.entryCount <= MAX_BUNDLE_ENTRIES
    && value.signatureAlgorithm === "ed25519"
    && typeof value.signature === "string";
}

function isRuntimeReleaseIndex(value: unknown): value is RuntimeReleaseIndex {
  return isRecord(value)
    && value.schemaVersion === UPDATE_INDEX_SCHEMA_VERSION
    && value.product === "Chatobby Runtime"
    && typeof value.version === "string"
    && /^\d+\.\d+\.\d+$/u.test(value.version)
    && typeof value.protocolVersion === "number"
    && typeof value.minimumPluginVersion === "string"
    && typeof value.maximumPluginVersion === "string"
    && Array.isArray(value.targets)
    && value.targets.length > 0
    && value.targets.every(isRuntimeReleaseTarget)
    && value.signatureAlgorithm === "ed25519"
    && typeof value.signature === "string";
}

function isRuntimeReleaseTarget(value: unknown): value is RuntimeReleaseTarget {
  if (!isRecord(value)) return false;
  const supportedTarget = (value.platform === "win32" && value.arch === "x64")
    || (value.platform === "darwin" && (value.arch === "x64" || value.arch === "arm64"));
  return supportedTarget
    && isRecord(value.bundle)
    && isRuntimeBundle(value.bundle);
}

function isRuntimeBundle(value: Record<string, unknown>): boolean {
  return value.format === BUNDLE_FORMAT
    && typeof value.file === "string"
    && /^[A-Za-z0-9._-]+\.cbr\.gz$/u.test(value.file)
    && typeof value.size === "number"
    && Number.isSafeInteger(value.size)
    && value.size > 0
    && value.size <= MAX_BUNDLE_BYTES
    && typeof value.sha256 === "string"
    && /^[a-f0-9]{64}$/u.test(value.sha256)
    && typeof value.uncompressedSize === "number"
    && Number.isSafeInteger(value.uncompressedSize)
    && value.uncompressedSize > 0
    && value.uncompressedSize <= MAX_UNCOMPRESSED_BYTES
    && typeof value.entryCount === "number"
    && Number.isSafeInteger(value.entryCount)
    && value.entryCount > 0
    && value.entryCount <= MAX_BUNDLE_ENTRIES;
}

function runtimeTargetKey(target: Pick<RuntimeReleaseTarget, "platform" | "arch">): RuntimeTargetKey {
  return `${target.platform}-${target.arch}` as RuntimeTargetKey;
}

function validateBundlePath(path: string): void {
  const segments = path.split("/");
  if (!path || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/u.test(path)) {
    throw new Error(`Runtime update bundle path is invalid: ${path}`);
  }
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Runtime update bundle path is invalid: ${path}`);
  }
}

function isCompatiblePluginVersion(version: string, minimum: string, maximum: string): boolean {
  const actual = parseVersion(version);
  const lower = parseVersion(minimum);
  const upper = maximum.endsWith(".x") ? parseVersion(`${maximum.slice(0, -2)}.999999`) : parseVersion(maximum);
  return Boolean(actual && lower && upper && compareTuple(actual, lower) >= 0 && compareTuple(actual, upper) <= 0);
}

function compareTuple(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function parseVersion(value: string): readonly [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBuffer(value: unknown): Buffer<ArrayBufferLike> {
  if (typeof value === "string" || value instanceof Uint8Array) return Buffer.from(value);
  throw new Error("Runtime update stream returned an unsupported chunk");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function abortError(): Error {
  const error = new Error("Runtime update was cancelled");
  error.name = "AbortError";
  return error;
}

function endWritable(stream: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });
}

async function writeBuffer(file: FileHandle, bytes: Buffer): Promise<void> {
  let offset = 0;
  while (offset < bytes.length) {
    const result = await file.write(bytes, offset, bytes.length - offset);
    if (result.bytesWritten <= 0) throw new Error("Runtime update bundle file write did not make progress");
    offset += result.bytesWritten;
  }
}
