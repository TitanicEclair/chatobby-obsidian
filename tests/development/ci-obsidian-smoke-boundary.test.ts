import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  validateCiObsidianSmokeInvocation,
  verifyCiConnectorArtifactReceipt,
} from "../../scripts/ci-obsidian-smoke.mjs";

const directories: string[] = [];
const trustedEnvironment = {
  GITHUB_EVENT_NAME: "push",
  GITHUB_REPOSITORY: "TitanicEclair/chatobby",
  GITHUB_REF: "refs/heads/dev",
  RUNNER_ENVIRONMENT: "self-hosted",
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("live Obsidian smoke trust boundary", () => {
  it("accepts only trusted private push runs on the dedicated runner", () => {
    expect(() => validateCiObsidianSmokeInvocation(trustedEnvironment)).not.toThrow();
    expect(() => validateCiObsidianSmokeInvocation({ ...trustedEnvironment, GITHUB_EVENT_NAME: "pull_request" }))
      .toThrow("trusted push events");
    expect(() => validateCiObsidianSmokeInvocation({ ...trustedEnvironment, GITHUB_REPOSITORY: "fork/chatobby" }))
      .toThrow("private connector repository");
    expect(() => validateCiObsidianSmokeInvocation({ ...trustedEnvironment, GITHUB_REF: "refs/heads/feature/x" }))
      .toThrow("dev, main, or release/* pushes");
    expect(() => validateCiObsidianSmokeInvocation({ ...trustedEnvironment, RUNNER_ENVIRONMENT: "github-hosted" }))
      .toThrow("dedicated self-hosted runner");
  });

  it("rejects extra, missing, mismatched, or tampered connector artifacts", async () => {
    const artifactRoot = await temporaryDirectory("chatobby-ci-receipt-");
    const revision = "0123456789abcdef";
    const names = ["main.js", "manifest.json", "styles.css"];
    const files = [];
    for (const name of names) {
      const bytes = Buffer.from(`${name} bytes\n`);
      await writeFile(join(artifactRoot, name), bytes);
      files.push({ name, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
    await writeFile(join(artifactRoot, "connector-artifact-receipt.json"), JSON.stringify({
      schemaVersion: 1,
      product: "Chatobby connector CI artifact",
      sourceRevision: revision,
      officialArtifactNames: names,
      files,
      temporaryVaultInstallContract: {
        passed: true,
        preservedPluginData: true,
        preservedRuntimeState: true,
        reloadPerformed: false,
      },
    }));

    await expect(verifyCiConnectorArtifactReceipt(artifactRoot, revision)).resolves.toMatchObject({
      sourceRevision: revision,
    });
    await writeFile(join(artifactRoot, "main.js"), "tampered\n");
    await expect(verifyCiConnectorArtifactReceipt(artifactRoot, revision)).rejects.toThrow("hash mismatch for main.js");
    await writeFile(join(artifactRoot, "unexpected"), "extra\n");
    await expect(verifyCiConnectorArtifactReceipt(artifactRoot, revision)).rejects.toThrow("unexpected file set");
  });
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}
