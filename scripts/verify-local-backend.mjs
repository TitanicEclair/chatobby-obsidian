import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const backendRoot = process.env.CHATOBBY_BACKEND_ROOT;
if (!backendRoot) {
  throw new Error(
    "Set CHATOBBY_BACKEND_ROOT to the pi-mono checkout before running this check",
  );
}

const backendCli = resolve(backendRoot, "packages/chatobby/dist/cli.js");
const generator = resolve(backendRoot, "scripts/build-vendor-artifacts.mjs");
const connectorVersion = readConnectorVersion();
const backendRevision = readBackendRevision();
const vendorPairs = (backendVendorRoot) => [
  {
    name: "managed local model contracts",
    backend: resolve(backendVendorRoot, "local-models"),
    connector: resolve("src/vendor/@chatobby/local-models"),
  },
  {
    name: "browser client",
    backend: resolve(backendVendorRoot, "chatobby-client"),
    connector: resolve("src/vendor/chatobby-client"),
  },
  {
    name: "Project contracts",
    backend: resolve(backendVendorRoot, "project-contracts"),
    connector: resolve("src/vendor/@chatobby/project-contracts"),
  },
  {
    name: "platform paths",
    backend: resolve(backendVendorRoot, "platform-paths"),
    connector: resolve("src/vendor/@chatobby/platform-paths"),
  },
];
const obsidianProtocolProjection = (backendVendorRoot) => ({
  name: "Obsidian protocol",
  artifact: "obsidian-protocol",
  backend: resolve(backendVendorRoot, "obsidian-protocol"),
  connector: resolve("src/vendor/@chatobby/obsidian-protocol"),
});

if (!existsSync(backendCli)) {
  throw new Error(`Compiled backend entry point not found: ${backendCli}`);
}
if (!existsSync(generator)) {
  throw new Error(`Backend vendor generator not found: ${generator}`);
}

const generatedRoot = mkdtempSync(join(tmpdir(), "chatobby-backend-projection-"));
try {
  generateBackendProjection(generatedRoot);
  for (const pair of vendorPairs(generatedRoot)) {
    const backendFiles = listFiles(pair.backend);
    const connectorFiles = listFiles(pair.connector);
    if (JSON.stringify(backendFiles) !== JSON.stringify(connectorFiles)) {
      throw new Error(
        `${pair.name} file lists differ; regenerate the exact backend projection and sync the connector copy`,
      );
    }
    for (const relativePath of backendFiles) {
      const backendHash = hashFile(resolve(pair.backend, relativePath));
      const connectorHash = hashFile(resolve(pair.connector, relativePath));
      if (backendHash !== connectorHash) {
        throw new Error(
          `${pair.name} differs from the current backend: ${relativePath}`,
        );
      }
    }
    console.log(
      `Verified ${backendFiles.length} ${pair.name} files against the fresh backend projection`,
    );
  }

  verifyDeclaredProjection(obsidianProtocolProjection(generatedRoot));

  console.log(`Backend CLI: ${backendCli}`);
  console.log(`Backend revision: ${backendRevision}`);
} finally {
  rmSync(generatedRoot, { recursive: true, force: true });
}

function generateBackendProjection(outputRoot) {
  const result = spawnSync(process.execPath, [
    generator,
    "--output-root",
    outputRoot,
    "--product-version",
    connectorVersion,
    "--expected-source-revision",
    backendRevision,
  ], {
    cwd: resolve(backendRoot),
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(
      `Could not generate the exact backend projection:\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`,
    );
  }
}

function readBackendRevision() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: resolve(backendRoot),
    encoding: "utf8",
    shell: false,
  });
  const revision = result.stdout.trim();
  if (result.status !== 0 || !/^[a-f0-9]{40}$/u.test(revision)) {
    throw new Error(`Could not resolve the exact backend revision: ${result.stderr.trim()}`);
  }
  return revision;
}

function readConnectorVersion() {
  const packagePath = resolve("package.json");
  const packageJson = JSON.parse(readFileRequired(packagePath).toString("utf8"));
  if (typeof packageJson.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(packageJson.version)) {
    throw new Error(`Connector package version is invalid: ${packagePath}`);
  }
  return packageJson.version;
}

function verifyDeclaredProjection(projection) {
  const backendManifestPath = resolve(projection.backend, "projection.json");
  const connectorManifestPath = resolve(
    projection.connector,
    "projection.json",
  );
  const backendManifestBytes = readFileRequired(backendManifestPath);
  const connectorManifestBytes = readFileRequired(connectorManifestPath);

  if (hashBytes(backendManifestBytes) !== hashBytes(connectorManifestBytes)) {
    throw new Error(
      `${projection.name} projection manifests differ; regenerate from the accepted backend and sync projection.json`,
    );
  }

  const manifest = parseProjectionManifest(
    backendManifestBytes,
    backendManifestPath,
    projection.artifact,
  );
  const seenPaths = new Set();
  for (const entry of manifest.files) {
    if (seenPaths.has(entry.path)) {
      throw new Error(
        `${projection.name} projection declares duplicate file: ${entry.path}`,
      );
    }
    seenPaths.add(entry.path);

    const backendPath = resolveDeclaredFile(
      projection.backend,
      entry.path,
      projection.name,
    );
    const connectorPath = resolveDeclaredFile(
      projection.connector,
      entry.path,
      projection.name,
    );
    verifyDeclaredFile(backendPath, entry, `${projection.name} backend`);
    verifyDeclaredFile(connectorPath, entry, `${projection.name} connector`);
  }

  console.log(
    `Verified ${manifest.files.length} generated ${projection.name} files against the fresh backend projection`,
  );
}

function parseProjectionManifest(bytes, path, expectedArtifact) {
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid projection manifest JSON: ${path}`, {
      cause: error,
    });
  }
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    manifest.schemaVersion !== 1 ||
    manifest.artifact !== expectedArtifact ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error(
      `Unsupported ${expectedArtifact} projection manifest: ${path}`,
    );
  }
  for (const entry of manifest.files) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      typeof entry.path !== "string" ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(entry.sha256)
    ) {
      throw new Error(
        `Invalid file declaration in ${expectedArtifact} projection manifest: ${path}`,
      );
    }
  }
  return manifest;
}

function resolveDeclaredFile(root, declaredPath, projectionName) {
  if (
    !declaredPath ||
    isAbsolute(declaredPath) ||
    declaredPath.includes("\\")
  ) {
    throw new Error(
      `${projectionName} projection contains an unsafe path: ${declaredPath}`,
    );
  }
  const resolvedPath = resolve(root, declaredPath);
  const relativePath = relative(root, resolvedPath);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Error(
      `${projectionName} projection contains an unsafe path: ${declaredPath}`,
    );
  }
  return resolvedPath;
}

function verifyDeclaredFile(path, entry, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} generated file not found: ${entry.path}`);
  }
  const actualSize = statSync(path).size;
  if (actualSize !== entry.size) {
    throw new Error(`${label} generated file size differs: ${entry.path}`);
  }
  if (hashFile(path) !== entry.sha256) {
    throw new Error(`${label} generated file hash differs: ${entry.path}`);
  }
}

function readFileRequired(path) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`File not found: ${path}`);
  }
  return readFileSync(path);
}

function listFiles(root) {
  if (!existsSync(root)) throw new Error(`Directory not found: ${root}`);
  return walk(root, "").sort();
}

function walk(root, relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  return readdirSync(directory).flatMap((name) => {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${name}`
      : name;
    return statSync(resolve(root, relativePath)).isDirectory()
      ? walk(root, relativePath)
      : [relativePath];
  });
}

function hashFile(path) {
  return hashBytes(readFileSync(path));
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
