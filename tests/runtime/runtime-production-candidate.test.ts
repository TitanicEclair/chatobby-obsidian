import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { afterEach, expect, it } from "vitest";
import {
  ManagedRuntimeResolver,
  readRuntimePackageManifest,
  RuntimePackageInstaller,
} from "../../src/runtime/infrastructure/runtime-installation";
import {
  extractRuntimeBundle,
  verifyRuntimeUpdateDescriptor,
} from "../../src/runtime/infrastructure/runtime-update-client";

const descriptorPath = process.env.CHATOBBY_CANDIDATE_DESCRIPTOR?.trim();
const publicKeyPath = process.env.CHATOBBY_CANDIDATE_PUBLIC_KEY?.trim();
const pluginVersion = process.env.CHATOBBY_CANDIDATE_PLUGIN_VERSION?.trim();
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it.runIf(Boolean(descriptorPath && publicKeyPath && pluginVersion))(
  "extracts, installs, resolves, and rolls back the real signed production candidate",
  async () => {
    const descriptorFile = resolve(requiredValue(descriptorPath, "candidate descriptor"));
    const publicKey = await readFile(resolve(requiredValue(publicKeyPath, "candidate public key")), "utf8");
    const version = requiredValue(pluginVersion, "candidate plugin version");
    const descriptorValue: unknown = JSON.parse(await readFile(descriptorFile, "utf8"));
    const descriptor = verifyRuntimeUpdateDescriptor(descriptorValue, version, publicKey);
    const bundle = join(dirname(descriptorFile), descriptor.bundle.file);
    const root = await temporaryDirectory();
    const extracted = join(root, "Downloaded Package With Spaces Ω");
    const installRoot = join(root, "Application Support", "Chatobby", "runtime");

    await extractRuntimeBundle(bundle, extracted, descriptor);
    const manifest = await readRuntimePackageManifest(extracted);
    const installer = new RuntimePackageInstaller(installRoot, publicKey);
    await installer.install(extracted, manifest, version);

    const resolver = new ManagedRuntimeResolver(() => null, () => installRoot, "release", version, publicKey);
    const initial = await resolver.resolve();
    expect(initial?.command).toBe(join(installRoot, "versions", manifest.version, manifest.executable));
    if (process.platform !== "win32") {
      expect((await stat(initial?.command ?? "")).mode & 0o777).toBe(0o700);
    }

    const replacement = await installer.prepareInstall(extracted, manifest, version);
    await replacement.rollback();
    const restored = await resolver.resolve();
    expect(restored).toEqual(initial);
  },
  120_000,
);

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "chatobby-production-candidate-"));
  directories.push(directory);
  return directory;
}

function requiredValue(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}
