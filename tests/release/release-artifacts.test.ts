import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const verifierPath = join(repositoryRoot, "scripts", "verify-release-artifacts.mjs");
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
