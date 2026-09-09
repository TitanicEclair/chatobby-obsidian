import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSupportedLinuxRuntime,
  extractRuntimeBundle,
  RuntimeUpdateClient,
  verifyRuntimeUpdateDescriptor,
  type RuntimeUpdateDescriptor,
  type RuntimeReleaseIndex,
} from "../../src/runtime/infrastructure/runtime-update-client";
import {
  CHATOBBY_GUIDE_ASSET_FORMAT,
  CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION,
  CHATOBBY_GUIDE_CHANNEL_CONSUMER_SCHEMA_VERSION,
  CHATOBBY_GUIDE_CHANNEL_NAME,
  CHATOBBY_GUIDE_CHANNEL_PRODUCT,
  CHATOBBY_GUIDE_CHANNEL_SCHEMA_VERSION,
  CHATOBBY_GUIDE_PRODUCT,
  CHATOBBY_RUNTIME_PROTOCOL_VERSION,
  chatobbyGuideChannelSigningPayload,
  type ChatobbyGuideChannel,
  type ChatobbyGuideChannelAsset,
} from "../../src/vendor/chatobby-client/ws-client.js";
import {
  CHATOBBY_GUIDE_CHANNEL_URL,
  chatobbyGuideChannelAssetUrl,
  chatobbyRuntimeIndexUrl,
} from "../../src/publication";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("runtime update client", () => {
  it("resolves only the immutable runtime index paired with the connector version", () => {
    expect(chatobbyRuntimeIndexUrl("0.4.3")).toBe(
      "https://github.com/TitanicEclair/chatobby-runtime/releases/download/0.4.3/runtime-index.json",
    );
    expect(chatobbyRuntimeIndexUrl("0.4.3")).not.toContain("/latest/");
  });
  it("resolves the stable guide channel and only its immutable asset namespace", () => {
    expect(CHATOBBY_GUIDE_CHANNEL_URL).toBe(
      "https://raw.githubusercontent.com/TitanicEclair/chatobby-runtime/main/guide-channel.json",
    );
    expect(chatobbyGuideChannelAssetUrl("guides/chatobby-guide-2026-09-05.1.json")).toBe(
      "https://raw.githubusercontent.com/TitanicEclair/chatobby-runtime/main/guides/chatobby-guide-2026-09-05.1.json",
    );
    expect(() => chatobbyGuideChannelAssetUrl("../guide.json")).toThrow("path is invalid");
  });
  it("fails fast on unsupported Linux libc environments", () => {
    expect(() => assertSupportedLinuxRuntime(undefined)).toThrow(/glibc-based distribution/u);
    expect(() => assertSupportedLinuxRuntime("2.27")).toThrow(/requires glibc 2\.28 or later/u);
    expect(() => assertSupportedLinuxRuntime("2.28")).not.toThrow();
    expect(() => assertSupportedLinuxRuntime("2.39")).not.toThrow();
  });
  it("accepts only a compatible descriptor signed by the embedded trust anchor", () => {
    const keys = generateKeyPairSync("ed25519");
    const descriptor = signedDescriptor(keys.privateKey);

    expect(verifyRuntimeUpdateDescriptor(descriptor, "0.1.2", publicKeyPem(keys.publicKey))).toBe(descriptor);
    expect(() => verifyRuntimeUpdateDescriptor(
      { ...descriptor, version: "0.1.3" },
      "0.1.2",
      publicKeyPem(keys.publicKey),
    )).toThrow("signature is invalid");

    const futureUnsigned = { ...descriptor, version: "0.1.3", signature: "" };
    const future = {
      ...futureUnsigned,
      signature: sign(null, Buffer.from(signingPayload(futureUnsigned), "utf8"), keys.privateKey).toString("base64"),
    };
    expect(() => verifyRuntimeUpdateDescriptor(
      future,
      "0.1.2",
      publicKeyPem(keys.publicKey),
    )).toThrow("not the immutable runtime paired with Chatobby 0.1.2");
  });

  it("selects only the exact signed target from a multi-platform index", () => {
    const keys = generateKeyPairSync("ed25519");
    const index = signedIndex(keys.privateKey);

    expect(verifyRuntimeUpdateDescriptor(
      index,
      "0.1.16",
      publicKeyPem(keys.publicKey),
      { platform: "darwin", arch: "arm64" },
    )).toMatchObject({
      schemaVersion: 3,
      platform: "darwin",
      arch: "arm64",
      bundle: { file: "chatobby-runtime-0.1.16-darwin-arm64.cbr.gz" },
    });
    expect(() => verifyRuntimeUpdateDescriptor(
      index,
      "0.1.16",
      publicKeyPem(keys.publicKey),
      { platform: "freebsd", arch: "x64" },
    )).toThrow("No Chatobby runtime is available for freebsd-x64");

    expect(verifyRuntimeUpdateDescriptor(
      index,
      "0.1.16",
      publicKeyPem(keys.publicKey),
      { platform: "linux", arch: "x64" },
    )).toMatchObject({ platform: "linux", arch: "x64" });
  });

  it("fetches a compatible guide revision only through the signed stable channel", async () => {
    const keys = generateKeyPairSync("ed25519");
    const asset = guideChannelAsset();
    const assetBytes = Buffer.from(`${JSON.stringify(asset)}\n`, "utf8");
    const channel = signedGuideChannel(keys.privateKey, assetBytes);
    const read = vi.fn(async (url: string) => {
      if (url === CHATOBBY_GUIDE_CHANNEL_URL) return Buffer.from(JSON.stringify(channel), "utf8");
      if (url === chatobbyGuideChannelAssetUrl(channel.guide.file)) return assetBytes;
      throw new Error(`Unexpected URL ${url}`);
    });
    const client = new RuntimeUpdateClient("unused", publicKeyPem(keys.publicKey), {
      read,
      download: async () => undefined,
    });

    await expect(client.fetchGuide("0.4.4")).resolves.toEqual(asset);
    expect(read).toHaveBeenNthCalledWith(1, CHATOBBY_GUIDE_CHANNEL_URL, expect.any(Number), undefined);
    expect(read).toHaveBeenNthCalledWith(
      2,
      chatobbyGuideChannelAssetUrl(channel.guide.file),
      assetBytes.length,
      undefined,
    );
  });

  it("rejects an incompatible or invalid Guide channel before requesting its asset", async () => {
    const keys = generateKeyPairSync("ed25519");
    const assetBytes = Buffer.from(JSON.stringify(guideChannelAsset()), "utf8");
    const incompatible = signedGuideChannel(keys.privateKey, assetBytes, {
      minimumConnectorVersion: "0.5.0",
      maximumConnectorVersion: "0.5.x",
    });
    const read = vi.fn(async () => Buffer.from(JSON.stringify(incompatible), "utf8"));
    const client = new RuntimeUpdateClient("unused", publicKeyPem(keys.publicKey), {
      read,
      download: async () => undefined,
    });

    await expect(client.fetchGuide("0.4.4")).rejects.toThrow("not compatible with connector 0.4.4");
    expect(read).toHaveBeenCalledOnce();

    const invalidSignature = { ...incompatible, signature: Buffer.alloc(64).toString("base64") };
    const invalidClient = new RuntimeUpdateClient("unused", publicKeyPem(keys.publicKey), {
      read: async () => Buffer.from(JSON.stringify(invalidSignature), "utf8"),
      download: async () => undefined,
    });
    await expect(invalidClient.fetchGuide("0.5.0")).rejects.toThrow("signature is invalid");
  });

  it("rejects Guide bytes that do not match the signed channel hash", async () => {
    const keys = generateKeyPairSync("ed25519");
    const assetBytes = Buffer.from(JSON.stringify(guideChannelAsset()), "utf8");
    const channel = signedGuideChannel(keys.privateKey, assetBytes);
    const reads = [Buffer.from(JSON.stringify(channel), "utf8"), Buffer.from("tampered", "utf8")];
    const client = new RuntimeUpdateClient("unused", publicKeyPem(keys.publicKey), {
      read: async () => reads.shift() ?? Buffer.alloc(0),
      download: async () => undefined,
    });

    await expect(client.fetchGuide("0.4.4")).rejects.toThrow("failed signed size or hash verification");
  });

  it("extracts a complete sorted bundle and rejects traversal before writing outside staging", async () => {
    const root = await temporaryDirectory();
    const archive = join(root, "runtime.cbr.gz");
    const destination = join(root, "package");
    const entries = [
      { path: "assets/file.txt", content: Buffer.from("asset") },
      { path: "runtime.manifest.json", content: Buffer.from("{}") },
    ];
    const descriptor = descriptorForEntries(entries);
    await writeFile(archive, encodeBundle(entries));

    await extractRuntimeBundle(archive, destination, descriptor);

    expect(await readFile(join(destination, "assets", "file.txt"), "utf8")).toBe("asset");
    expect(await readFile(join(destination, "runtime.manifest.json"), "utf8")).toBe("{}");

    const unsafeArchive = join(root, "unsafe.cbr.gz");
    const unsafeEntries = [
      { path: "../escape.txt", content: Buffer.from("escape") },
      { path: "runtime.manifest.json", content: Buffer.from("{}") },
    ];
    await writeFile(unsafeArchive, encodeBundle(unsafeEntries));
    await expect(extractRuntimeBundle(
      unsafeArchive,
      join(root, "unsafe-package"),
      descriptorForEntries(unsafeEntries),
    )).rejects.toThrow("path is invalid");
    await expect(readFile(join(root, "escape.txt"))).rejects.toThrow();
  });

  it("rejects truncated and descriptor-mismatched bundles", async () => {
    const root = await temporaryDirectory();
    const entries = [{ path: "runtime.manifest.json", content: Buffer.from("{}") }];
    const complete = encodeBundle(entries);
    const archive = join(root, "truncated.cbr.gz");
    await writeFile(archive, complete.subarray(0, complete.length - 4));

    await expect(extractRuntimeBundle(
      archive,
      join(root, "truncated"),
      descriptorForEntries(entries),
    )).rejects.toThrow();

    const validArchive = join(root, "valid.cbr.gz");
    await writeFile(validArchive, complete);
    const wrong = descriptorForEntries(entries);
    wrong.bundle.uncompressedSize += 1;
    await expect(extractRuntimeBundle(validArchive, join(root, "wrong"), wrong)).rejects.toThrow(
      "size does not match",
    );
  });
});

function signedDescriptor(privateKey: KeyObject): RuntimeUpdateDescriptor {
  const descriptor = descriptorForEntries([{ path: "runtime.manifest.json", content: Buffer.from("{}") }]);
  return {
    ...descriptor,
    signature: sign(null, Buffer.from(signingPayload(descriptor), "utf8"), privateKey).toString("base64"),
  };
}

function signedIndex(privateKey: KeyObject, guideBytes?: Buffer): RuntimeReleaseIndex {
  const target = (platform: "win32" | "darwin" | "linux", arch: "x64" | "arm64") => ({
    platform,
    arch,
    bundle: {
      format: "chatobby-runtime-bundle-v1" as const,
      file: `chatobby-runtime-0.1.16-${platform}-${arch}.cbr.gz`,
      size: 1,
      sha256: "a".repeat(64),
      uncompressedSize: 1,
      entryCount: 1,
    },
  });
  const unsigned = {
    schemaVersion: 3 as const,
    product: "Chatobby Runtime" as const,
    version: "0.1.16",
    protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
    minimumPluginVersion: "0.1.0",
    maximumPluginVersion: "0.1.x",
    guide: {
      schemaVersion: 1 as const,
      product: "Chatobby Guide" as const,
      productVersion: "0.1.16",
      guideRevision: "2026-08-21.1",
      format: "chatobby-guide-file-set-v1" as const,
      file: "chatobby-guide-0.1.16.json",
      size: guideBytes?.length ?? 100,
      sha256: guideBytes ? createHash("sha256").update(guideBytes).digest("hex") : "b".repeat(64),
      fileCount: guideBytes ? 1 : 10,
    },
    targets: [
      target("darwin", "arm64"),
      target("darwin", "x64"),
      target("linux", "arm64"),
      target("linux", "x64"),
      target("win32", "x64"),
    ],
  };
  return {
    ...unsigned,
    signatureAlgorithm: "ed25519",
    signature: sign(null, Buffer.from(indexSigningPayload(unsigned), "utf8"), privateKey).toString("base64"),
  };
}

function descriptorForEntries(entries: readonly BundleEntry[]): RuntimeUpdateDescriptor {
  return {
    schemaVersion: 1,
    product: "Chatobby Runtime",
    version: "0.1.2",
    protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
    minimumPluginVersion: "0.1.0",
    maximumPluginVersion: "0.1.x",
    platform: process.platform,
    arch: process.arch,
    bundle: {
      format: "chatobby-runtime-bundle-v1",
      file: `chatobby-runtime-0.1.2-${process.platform}-${process.arch}.cbr.gz`,
      size: 1,
      sha256: "a".repeat(64),
      uncompressedSize: entries.reduce((total, entry) => total + entry.content.length, 0),
      entryCount: entries.length,
    },
    signatureAlgorithm: "ed25519",
    signature: "fixture",
  };
}

interface BundleEntry {
  path: string;
  content: Buffer;
}

function encodeBundle(entries: readonly BundleEntry[]): Buffer {
  const chunks = [Buffer.from("CHATOBBY-RUNTIME-BUNDLE/1\n", "utf8")];
  for (const entry of entries) {
    const header = Buffer.from(JSON.stringify({ path: entry.path, size: entry.content.length }), "utf8");
    const size = Buffer.alloc(4);
    size.writeUInt32BE(header.length);
    chunks.push(size, header, entry.content);
  }
  chunks.push(Buffer.alloc(4));
  return gzipSync(Buffer.concat(chunks));
}

function signingPayload(value: RuntimeUpdateDescriptor): string {
  return JSON.stringify({
    schemaVersion: value.schemaVersion,
    product: value.product,
    version: value.version,
    protocolVersion: value.protocolVersion,
    minimumPluginVersion: value.minimumPluginVersion,
    maximumPluginVersion: value.maximumPluginVersion,
    platform: value.platform,
    arch: value.arch,
    bundle: value.bundle,
  });
}

function indexSigningPayload(value: Omit<RuntimeReleaseIndex, "signatureAlgorithm" | "signature">): string {
  return JSON.stringify(value);
}

function publicKeyPem(key: KeyObject): string {
  return key.export({ type: "spki", format: "pem" }).toString();
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "chatobby-runtime-update-"));
  directories.push(directory);
  return directory;
}

function guideChannelAsset(): ChatobbyGuideChannelAsset {
  return {
    schemaVersion: CHATOBBY_GUIDE_CHANNEL_ASSET_SCHEMA_VERSION,
    product: CHATOBBY_GUIDE_PRODUCT,
    guideRevision: "2026-09-05.1",
    format: CHATOBBY_GUIDE_ASSET_FORMAT,
    indexPath: "Chatobby Guide/00 - Start Here.md",
    title: "Chatobby Guide",
    earlyAccess: true,
    confirmationNotice: "Write the compatible guide?",
    files: [{ path: "Chatobby Guide/00 - Start Here.md", title: "Start Here", content: "# Start Here\n" }],
  };
}

function signedGuideChannel(
  privateKey: KeyObject,
  assetBytes: Buffer,
  compatibility: {
    minimumConnectorVersion: string;
    maximumConnectorVersion: string;
  } = { minimumConnectorVersion: "0.4.4", maximumConnectorVersion: "0.4.x" },
): ChatobbyGuideChannel {
  const asset = guideChannelAsset();
  const unsigned: Omit<ChatobbyGuideChannel, "signatureAlgorithm" | "signature"> = {
    schemaVersion: CHATOBBY_GUIDE_CHANNEL_SCHEMA_VERSION,
    product: CHATOBBY_GUIDE_CHANNEL_PRODUCT,
    channel: CHATOBBY_GUIDE_CHANNEL_NAME,
    ...compatibility,
    minimumConsumerSchemaVersion: CHATOBBY_GUIDE_CHANNEL_CONSUMER_SCHEMA_VERSION,
    maximumConsumerSchemaVersion: CHATOBBY_GUIDE_CHANNEL_CONSUMER_SCHEMA_VERSION,
    guide: {
      schemaVersion: asset.schemaVersion,
      product: asset.product,
      guideRevision: asset.guideRevision,
      format: asset.format,
      file: `guides/chatobby-guide-${asset.guideRevision}.json`,
      size: assetBytes.length,
      sha256: createHash("sha256").update(assetBytes).digest("hex"),
      fileCount: asset.files.length,
    },
  };
  return {
    ...unsigned,
    signatureAlgorithm: "ed25519",
    signature: sign(
      null,
      Buffer.from(chatobbyGuideChannelSigningPayload(unsigned), "utf8"),
      privateKey,
    ).toString("base64"),
  };
}
