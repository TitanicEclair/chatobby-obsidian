import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { generateKeyPairSync } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const verifierPath = join(repositoryRoot, "scripts", "verify-release-artifacts.mjs");
const buildConfigPath = join(repositoryRoot, "esbuild.config.mjs");
const packageManifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as { version: string };
const packageVersion = packageManifest.version;
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("release artifact verification", () => {
  it("accepts the exact source-free Obsidian release asset set", async () => {
    const directory = await releaseFixture("(()=>{})();");
    const result = runVerifier(directory);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Verified release assets");
  });

  it("rejects source maps and developer workstation paths", async () => {
    const directory = await releaseFixture(
      'const root="C:\\chatobby\\pi-mono";\n//# sourceMappingURL=data:application/json;base64,AAAA',
    );
    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("source map");
    expect(result.stderr).toContain("development checkout path");
  });

  it("rejects settings or other files beside the three official assets", async () => {
    const directory = await releaseFixture("(()=>{})();");
    await writeFile(join(directory, "data.json"), "{}", "utf8");
    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must contain exactly");
  });

  it("rejects a development Guide feed marker from release artifacts", async () => {
    const directory = await releaseFixture("/* CHATOBBY_DEV_GUIDE_FEED_OVERRIDE_V1 */");
    const result = runVerifier(directory);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("development Guide feed override");
  });

  it("accepts only a keyed loopback HTTPS Guide feed for development validation", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const result = runBuildConfig({
      CHATOBBY_DEV_GUIDE_FEED_BASE_URL: "https://LOCALHOST:18454/chatobby-guide/",
      CHATOBBY_RUNTIME_PUBLIC_KEY: publicKey.export({ type: "spki", format: "pem" }).toString(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"developmentGuideFeedBaseUrl":"https://localhost:18454/chatobby-guide/"');
  });

  it("rejects unsafe or release Guide feed overrides before building artifacts", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const remote = runBuildConfig({
      CHATOBBY_DEV_GUIDE_FEED_BASE_URL: "https://example.test/chatobby-guide/",
      CHATOBBY_RUNTIME_PUBLIC_KEY: publicKeyPem,
    });
    const insecure = runBuildConfig({
      CHATOBBY_DEV_GUIDE_FEED_BASE_URL: "http://127.0.0.1:18454/chatobby-guide/",
      CHATOBBY_RUNTIME_PUBLIC_KEY: publicKeyPem,
    });
    const unkeyed = runBuildConfig({
      CHATOBBY_DEV_GUIDE_FEED_BASE_URL: "https://127.0.0.1:18454/chatobby-guide/",
    });
    const privateKeyInput = runBuildConfig({
      CHATOBBY_DEV_GUIDE_FEED_BASE_URL: "https://127.0.0.1:18454/chatobby-guide/",
      CHATOBBY_RUNTIME_PUBLIC_KEY: privateKeyPem,
    });
    const release = runBuildConfig(
      {
        CHATOBBY_DEV_GUIDE_FEED_BASE_URL: "https://localhost:18454/chatobby-guide/",
        CHATOBBY_RUNTIME_PUBLIC_KEY: publicKeyPem,
      },
      true,
    );

    expect(remote.status).not.toBe(0);
    expect(remote.stderr).toContain("credential-free localhost or 127.0.0.1 HTTPS");
    expect(insecure.status).not.toBe(0);
    expect(insecure.stderr).toContain("credential-free localhost or 127.0.0.1 HTTPS");
    expect(unkeyed.status).not.toBe(0);
    expect(unkeyed.stderr).toContain("CHATOBBY_RUNTIME_PUBLIC_KEY is required");
    expect(privateKeyInput.status).not.toBe(0);
    expect(privateKeyInput.stderr).toContain("must not contain private key material");
    expect(privateKeyInput.stderr).not.toContain(privateKeyPem);
    expect(privateKeyInput.stdout).not.toContain(privateKeyPem);
    expect(release.status).not.toBe(0);
    expect(release.stderr).toContain("forbidden in a release build");
  });
});

async function releaseFixture(main: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "chatobby-release-"));
  directories.push(directory);
  await Promise.all([
    writeFile(join(directory, "main.js"), main, "utf8"),
    writeFile(join(directory, "manifest.json"), JSON.stringify({ version: packageVersion }), "utf8"),
    writeFile(join(directory, "styles.css"), ".chatobby-view{}", "utf8"),
  ]);
  return directory;
}

function runVerifier(directory: string): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [verifierPath, directory], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function runBuildConfig(
  values: Record<string, string>,
  release = false,
): ReturnType<typeof spawnSync> {
  const environment: NodeJS.ProcessEnv = { ...process.env };
  delete environment.CHATOBBY_DEV_GUIDE_FEED_BASE_URL;
  delete environment.CHATOBBY_RUNTIME_PUBLIC_KEY;
  Object.assign(environment, values);
  return spawnSync(
    process.execPath,
    [buildConfigPath, ...(release ? ["--release"] : []), "--validate-guide-feed-only"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: environment,
    },
  );
}
