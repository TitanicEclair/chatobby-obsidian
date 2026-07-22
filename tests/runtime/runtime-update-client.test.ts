import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractRuntimeBundle,
  verifyRuntimeUpdateDescriptor,
  type RuntimeUpdateDescriptor,
  type RuntimeReleaseIndex,
} from "../../src/runtime/infrastructure/runtime-update-client";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("runtime update client", () => {
  it("accepts only a compatible descriptor signed by the embedded trust anchor", () => {
    const keys = generateKeyPairSync("ed25519");
    const descriptor = signedDescriptor(keys.privateKey);

    expect(verifyRuntimeUpdateDescriptor(descriptor, "0.1.2", publicKeyPem(keys.publicKey))).toBe(descriptor);
    expect(() => verifyRuntimeUpdateDescriptor(
      { ...descriptor, version: "0.1.3" },
      "0.1.2",
      publicKeyPem(keys.publicKey),
    )).toThrow("signature is invalid");
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
      schemaVersion: 2,
      platform: "darwin",
      arch: "arm64",
      bundle: { file: "chatobby-runtime-0.1.16-darwin-arm64.cbr.gz" },
    });
    expect(() => verifyRuntimeUpdateDescriptor(
      index,
      "0.1.16",
      publicKeyPem(keys.publicKey),
      { platform: "linux", arch: "x64" },
    )).toThrow("No Chatobby runtime is available for linux-x64");
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

function signedIndex(privateKey: KeyObject): RuntimeReleaseIndex {
  const target = (platform: "win32" | "darwin", arch: "x64" | "arm64") => ({
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
    schemaVersion: 2 as const,
    product: "Chatobby Runtime" as const,
    version: "0.1.16",
    protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
    minimumPluginVersion: "0.1.0",
    maximumPluginVersion: "0.1.x",
    targets: [target("darwin", "arm64"), target("darwin", "x64"), target("win32", "x64")],
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
