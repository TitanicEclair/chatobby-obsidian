import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ProjectionEvidence {
  schemaVersion: 1;
  sourceRepository: string;
  sourceCommit: string;
  generator: string;
  sourceArtifact: string;
  connectorArtifact: string;
  projectionManifest: string;
  projectionManifestSha256: string;
}

interface ProjectionManifest {
  schemaVersion: 1;
  artifact: "obsidian-protocol";
  protocolVersion: number;
  files: Array<{ path: string; size: number; sha256: string }>;
}

const repositoryRoot = resolve(import.meta.dirname, "../..");
const vendorRoot = join(repositoryRoot, "src/vendor/@chatobby/obsidian-protocol");
const evidence = JSON.parse(
  readFileSync(join(import.meta.dirname, "obsidian-protocol.projection.json"), "utf8"),
) as ProjectionEvidence;

describe("generated Obsidian protocol boundary", () => {
  it("pins the accepted source projection and verifies every declared generated file", () => {
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      sourceRepository: "TitanicEclair/pi-mono",
      sourceCommit: "984e4060251356a66e23d939dbabfe70198663ab",
      generator: "scripts/build-vendor-artifacts.mjs",
      sourceArtifact: "vendor/obsidian-protocol",
      connectorArtifact: "src/vendor/@chatobby/obsidian-protocol",
      projectionManifest: "projection.json",
    });

    const manifestPath = join(vendorRoot, evidence.projectionManifest);
    const manifestBytes = readFileSync(manifestPath);
    expect(hash(manifestBytes)).toBe(evidence.projectionManifestSha256);

    const manifest = JSON.parse(manifestBytes.toString("utf8")) as ProjectionManifest;
    expect(manifest).toMatchObject({ schemaVersion: 1, artifact: "obsidian-protocol", protocolVersion: 2 });
    expect(manifest.files).toHaveLength(26);
    expect(readdirSync(vendorRoot).sort()).toEqual(
      [...manifest.files.map((file) => file.path), evidence.projectionManifest].sort(),
    );

    for (const file of manifest.files) {
      const path = join(vendorRoot, file.path);
      const bytes = readFileSync(path);
      expect(statSync(path).size, file.path).toBe(file.size);
      expect(hash(bytes), file.path).toBe(file.sha256);
    }
  });
});

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
