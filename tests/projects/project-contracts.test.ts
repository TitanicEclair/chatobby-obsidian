import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ProjectContractError,
  parseProjectRecordV1,
  projectProjectSummary,
} from "../../src/vendor/@chatobby/project-contracts/index.js";

interface ProjectionEvidence {
  schemaVersion: 1;
  sourceRepository: string;
  sourceCommit: string;
  generator: string;
  sourceArtifact: string;
  connectorArtifact: string;
  files: Record<string, string>;
}

const repositoryRoot = resolve(import.meta.dirname, "../..");
const vendorRoot = join(repositoryRoot, "src/vendor/@chatobby/project-contracts");
const evidence = JSON.parse(
  readFileSync(join(import.meta.dirname, "project-contracts.projection.json"), "utf8"),
) as ProjectionEvidence;
const now = "2026-08-07T01:02:03.000Z";

describe("generated Project contract boundary", () => {
  it("matches the exact source-commit projection receipt", () => {
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      sourceRepository: "TitanicEclair/pi-mono",
      sourceCommit: "8e438762ccc90ad8110aba3cc051ac50cae98bbf",
      generator: "scripts/build-vendor-artifacts.mjs",
      sourceArtifact: "vendor/project-contracts",
      connectorArtifact: "src/vendor/@chatobby/project-contracts",
    });
    const actualFiles = readdirSync(vendorRoot).sort();
    expect(actualFiles).toEqual(Object.keys(evidence.files).sort());
    for (const file of actualFiles) {
      const hash = createHash("sha256").update(readFileSync(join(vendorRoot, file))).digest("hex");
      expect(hash, file).toBe(evidence.files[file]);
    }
  });

  it("remains browser-safe and has one explicit stable-identity consumer", () => {
    for (const file of readdirSync(vendorRoot)) {
      const source = readFileSync(join(vendorRoot, file), "utf8");
      const imports = [...source.matchAll(/(?:from\s+|import\s*\()["']([^"']+)["']/gu)].map(
        (match) => match[1]!,
      );
      expect(imports, file).toEqual(imports.filter((specifier) => specifier.startsWith("./")));
    }

    const consumers = sourceFiles(join(repositoryRoot, "src"))
      .filter((path) => !path.startsWith("src/vendor/"))
      .filter((path) => readFileSync(join(repositoryRoot, path), "utf8").includes("project-contracts"));
    expect(consumers).toEqual(["src/vault-runtime.ts"]);
  });

  it("executes the canonical parser and deterministic projection without connector adapters", () => {
    const record = parseProjectRecordV1({
      schemaVersion: 1,
      projectId: "project_alpha",
      vaultId: "vault_main",
      revision: 1,
      name: "Alpha",
      lifecycle: "active",
      creationKind: "manual",
      primaryRootId: "root_primary",
      roots: [
        {
          rootId: "root_primary",
          directoryId: "directory_alpha",
          label: "Primary",
          location: { kind: "vault-relative", relativePath: "Projects/Alpha" },
          markerPolicy: "required",
          directoryReuse: "canonical",
          createdAt: now,
        },
      ],
      defaults: { gitPolicy: "off" },
      createdAt: now,
      updatedAt: now,
    });

    expect(projectProjectSummary(record)).toMatchObject({
      schemaVersion: 1,
      name: "Alpha",
      primaryRootLabel: "Primary",
      rootCount: 1,
    });
    expect(() => parseProjectRecordV1({ ...record, schemaVersion: 2 })).toThrow(ProjectContractError);
  });
});

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.isFile() && /\.(?:ts|js|mjs)$/u.test(entry.name)) {
      files.push(relative(repositoryRoot, path).replaceAll("\\", "/"));
    }
  }
  return files;
}
