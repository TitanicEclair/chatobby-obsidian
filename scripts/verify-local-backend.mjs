import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const backendRoot = process.env.CHATOBBY_BACKEND_ROOT;
if (!backendRoot) {
  throw new Error("Set CHATOBBY_BACKEND_ROOT to the pi-mono checkout before running this check");
}

const backendCli = resolve(backendRoot, "packages/chatobby/dist/cli.js");
const vendorPairs = [
  {
    name: "browser client",
    backend: resolve(backendRoot, "vendor/chatobby-client"),
    connector: resolve("src/vendor/chatobby-client"),
  },
  {
    name: "Project contracts",
    backend: resolve(backendRoot, "vendor/project-contracts"),
    connector: resolve("src/vendor/@chatobby/project-contracts"),
  },
  {
    name: "platform paths",
    backend: resolve(backendRoot, "vendor/platform-paths"),
    connector: resolve("src/vendor/@chatobby/platform-paths"),
  },
];
const obsidianProtocolProjection = {
  name: "Obsidian protocol",
  artifact: "obsidian-protocol",
  backend: resolve(backendRoot, "vendor/obsidian-protocol"),
  connector: resolve("src/vendor/@chatobby/obsidian-protocol"),
};

if (!existsSync(backendCli)) {
  throw new Error(`Compiled backend entry point not found: ${backendCli}`);
}

for (const pair of vendorPairs) {
  const backendFiles = listFiles(pair.backend);
  const connectorFiles = listFiles(pair.connector);
  if (JSON.stringify(backendFiles) !== JSON.stringify(connectorFiles)) {
    throw new Error(
      `${pair.name} file lists differ; run npm run build:vendor in pi-mono and sync the connector copy`,
    );
  }
  for (const relativePath of backendFiles) {
    const backendHash = hashFile(resolve(pair.backend, relativePath));
    const connectorHash = hashFile(resolve(pair.connector, relativePath));
    if (backendHash !== connectorHash) {
      throw new Error(`${pair.name} differs from the current backend: ${relativePath}`);
    }
  }
  console.log(`Verified ${backendFiles.length} ${pair.name} files against ${pair.backend}`);
}

verifyDeclaredProjection(obsidianProtocolProjection);

console.log(`Backend CLI: ${backendCli}`);

function verifyDeclaredProjection(projection) {
  const backendManifestPath = resolve(projection.backend, "projection.json");
  const connectorManifestPath = resolve(projection.connector, "projection.json");
  const backendManifestBytes = readFileRequired(backendManifestPath);
  const connectorManifestBytes = readFileRequired(connectorManifestPath);

  if (hashBytes(backendManifestBytes) !== hashBytes(connectorManifestBytes)) {
    throw new Error(
      `${projection.name} projection manifests differ; regenerate from the accepted backend and sync projection.json`,
    );
  }

  const manifest = parseProjectionManifest(backendManifestBytes, backendManifestPath, projection.artifact);
  const seenPaths = new Set();
  for (const entry of manifest.files) {
    if (seenPaths.has(entry.path)) {
      throw new Error(`${projection.name} projection declares duplicate file: ${entry.path}`);
    }
    seenPaths.add(entry.path);

    const backendPath = resolveDeclaredFile(projection.backend, entry.path, projection.name);
    const connectorPath = resolveDeclaredFile(projection.connector, entry.path, projection.name);
    verifyDeclaredFile(backendPath, entry, `${projection.name} backend`);
    verifyDeclaredFile(connectorPath, entry, `${projection.name} connector`);
  }

  console.log(
    `Verified ${manifest.files.length} generated ${projection.name} files against ${projection.backend}`,
  );
}

function parseProjectionManifest(bytes, path, expectedArtifact) {
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid projection manifest JSON: ${path}`, { cause: error });
  }
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    manifest.schemaVersion !== 1 ||
    manifest.artifact !== expectedArtifact ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error(`Unsupported ${expectedArtifact} projection manifest: ${path}`);
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
      throw new Error(`Invalid file declaration in ${expectedArtifact} projection manifest: ${path}`);
    }
  }
  return manifest;
}

function resolveDeclaredFile(root, declaredPath, projectionName) {
  if (!declaredPath || isAbsolute(declaredPath) || declaredPath.includes("\\")) {
    throw new Error(`${projectionName} projection contains an unsafe path: ${declaredPath}`);
  }
  const resolvedPath = resolve(root, declaredPath);
  const relativePath = relative(root, resolvedPath);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`${projectionName} projection contains an unsafe path: ${declaredPath}`);
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
    const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
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
