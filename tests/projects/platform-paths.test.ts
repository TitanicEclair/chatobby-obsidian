import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIRECTORY_MARKER_FILENAME,
  encodePlatformPathKey,
  getPlatformPathRole,
  resolveConnectorPlatformPath,
} from "../../src/vendor/@chatobby/platform-paths/index.js";

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
const vendorRoot = join(repositoryRoot, "src/vendor/@chatobby/platform-paths");
const evidence = JSON.parse(
  readFileSync(join(import.meta.dirname, "platform-paths.projection.json"), "utf8"),
) as ProjectionEvidence;

describe("generated platform-path contract boundary", () => {
  it("matches the exact source-commit projection receipt", () => {
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      sourceRepository: "TitanicEclair/pi-mono",
      sourceCommit: "7e31722a59f554bcca3fac49fb13c620c8638328",
      generator: "scripts/build-vendor-artifacts.mjs",
      sourceArtifact: "vendor/platform-paths",
      connectorArtifact: "src/vendor/@chatobby/platform-paths",
    });
    const actualFiles = readdirSync(vendorRoot).sort();
    expect(actualFiles).toEqual(Object.keys(evidence.files).sort());
    for (const file of actualFiles) {
      const hash = createHash("sha256").update(readFileSync(join(vendorRoot, file))).digest("hex");
      expect(hash, file).toBe(evidence.files[file]);
    }
  });

  it("keeps the generated runtime module limited to declared dependencies and no consumers", () => {
    for (const file of readdirSync(vendorRoot)) {
      const source = readFileSync(join(vendorRoot, file), "utf8");
      const imports = [...source.matchAll(/(?:from\s+|import\s*\()["']([^"']+)["']/gu)].map(
        (match) => match[1]!,
      );
      expect(imports, file).toEqual(
        imports.filter(
          (specifier) => specifier.startsWith("./")
            || specifier === "node:path"
            || specifier === "@chatobby/project-contracts",
        ),
      );
    }

    const consumers = sourceFiles(join(repositoryRoot, "src"))
      .filter((path) => !path.startsWith("src/vendor/@chatobby/platform-paths/"))
      .filter((path) => {
        const source = readFileSync(join(repositoryRoot, path), "utf8");
        return source.includes("@chatobby/platform-paths")
          || source.includes("vendor/@chatobby/platform-paths");
      });
    expect(consumers).toEqual([]);
  });

  it("executes deterministic connector path resolution without activating it in product behavior", () => {
    expect(DIRECTORY_MARKER_FILENAME).toBe(".chatobby-root.json");
    expect(getPlatformPathRole("projects-device-identity")).toMatchObject({
      owner: "source-runtime",
      authority: "device-local",
      kind: "file",
    });
    for (const role of ["projects-marker-index", "projects-root-operation-journal"] as const) {
      expect(getPlatformPathRole(role)).toMatchObject({
        owner: "source-runtime",
        authority: "device-local",
        kind: "file",
      });
    }

    expect(getPlatformPathRole("runtime-current-pointer")).toMatchObject({
      owner: "connector",
      authority: "device-local",
      kind: "file",
    });

    expect(resolveConnectorPlatformPath({
      platform: "win32",
      homeDirectory: "C:\\Users\\Alice",
      variables: { LOCALAPPDATA: "D:\\User Data" },
    }, { role: "runtime-current-pointer" })).toBe("D:\\User Data\\Chatobby\\runtime\\current.json");

    const vaultId = "vault_main";
    expect(resolveConnectorPlatformPath({
      platform: "darwin",
      homeDirectory: "/Users/alice",
    }, { role: "runtime-vault-log", vaultId })).toBe(
      `/Users/alice/Library/Logs/Chatobby/${encodePlatformPathKey(vaultId)}/runtime.log`,
    );

    expect(resolveConnectorPlatformPath({
      platform: "linux",
      homeDirectory: "/home/alice",
      variables: { XDG_DATA_HOME: "/data/alice", XDG_STATE_HOME: "/state/alice" },
    }, { role: "runtime-versions-root" })).toBe("/data/alice/Chatobby/runtime/versions");
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
