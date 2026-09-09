import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = resolve(import.meta.dirname, "..");

/** Prepare or apply the explicitly allowlisted Markdown projection to the public connector checkout. */
export async function projectPublicDocumentation({
  repositoryRoot,
  destination,
  apply = false,
  sourceRevision,
  destinationRevision,
  verifyCheckout = false,
}) {
  if (!isAbsolute(destination)) throw new Error("Public documentation destination must be absolute");
  const sourceRoot = resolve(repositoryRoot);
  const destinationRoot = resolve(destination);
  const destinationRelation = relative(sourceRoot, destinationRoot);
  if (destinationRelation === "" || (!destinationRelation.startsWith("..") && !isAbsolute(destinationRelation))) {
    throw new Error("Public documentation destination must not be inside the private repository");
  }

  const policy = JSON.parse(await readFile(join(sourceRoot, "config", "public-documentation-projection.json"), "utf8"));
  validatePolicy(policy);
  const sourceRootReal = await validateRoot(sourceRoot, "private source");
  const destinationRootReal = await validateRoot(destinationRoot, "public destination");
  const sourceStatus = gitStatus(sourceRoot);
  const destinationStatus = gitStatus(destinationRoot);
  if (verifyCheckout) verifyRepositories(sourceRoot, destinationRoot, policy);
  if (apply && sourceStatus.length > 0) throw new Error("Public documentation apply requires a clean private source checkout");
  if (apply && destinationStatus.length > 0) throw new Error("Public documentation apply requires a clean destination checkout");

  const changes = [];
  const unchanged = [];
  for (const path of policy.files) {
    const sourcePath = join(sourceRoot, path);
    await validateProjectionPath(sourceRoot, sourceRootReal, path, true);
    await validateProjectionPath(destinationRoot, destinationRootReal, path, false);
    const source = await readFile(sourcePath);
    const current = await readOptionalRegularFile(join(destinationRoot, path));
    const sourceSha256 = sha256(source);
    const destinationSha256 = current ? sha256(current) : null;
    if (sourceSha256 === destinationSha256) {
      unchanged.push(path);
      continue;
    }
    changes.push({
      path,
      action: current ? "update" : "add",
      bytes: source.byteLength,
      sourceSha256,
      destinationSha256,
    });
    if (apply) await writeAtomically(join(destinationRoot, path), source);
  }

  for (const path of policy.retiredFiles) {
    await validateProjectionPath(destinationRoot, destinationRootReal, path, false);
    const current = await readOptionalRegularFile(join(destinationRoot, path));
    if (!current) {
      unchanged.push(path);
      continue;
    }
    changes.push({
      path,
      action: "delete",
      bytes: 0,
      sourceSha256: null,
      destinationSha256: sha256(current),
    });
    if (apply) await rm(join(destinationRoot, path));
  }

  return {
    schemaVersion: 1,
    mode: apply ? "apply" : "dry-run",
    sourceRevision: sourceRevision ?? gitRevision(sourceRoot),
    destinationRevision: destinationRevision ?? gitRevision(destinationRoot),
    destinationRepository: policy.destinationRepository,
    sourceDirty: sourceStatus.length > 0,
    destinationDirty: destinationStatus.length > 0,
    filesConsidered: policy.files.length + policy.retiredFiles.length,
    changes,
    unchanged,
    releaseAssetsChanged: false,
  };
}

function validatePolicy(policy) {
  if (policy.schemaVersion !== 1) throw new Error("Unsupported public documentation projection schemaVersion");
  if (typeof policy.sourceRepository !== "string" || policy.sourceRepository.length === 0) {
    throw new Error("Public documentation policy must name the private source repository");
  }
  if (typeof policy.destinationRepository !== "string" || policy.destinationRepository.length === 0) {
    throw new Error("Public documentation policy must name the destination repository");
  }
  if (!Array.isArray(policy.files) || !Array.isArray(policy.retiredFiles)) {
    throw new Error("Public documentation policy must define files and retiredFiles arrays");
  }
  const all = [...policy.files, ...policy.retiredFiles];
  if (new Set(all).size !== all.length) throw new Error("Public documentation projection paths must be unique");
  for (const path of all) {
    if (typeof path !== "string" || path.includes("\\") || path.startsWith("/") || path.split("/").includes("..")) {
      throw new Error(`Invalid public documentation projection path: ${String(path)}`);
    }
    if (path !== "README.md" && !(path.startsWith("docs/") && path.endsWith(".md"))) {
      throw new Error(`Public documentation projection may contain only README.md or docs/*.md: ${path}`);
    }
  }
}

function verifyRepositories(sourceRoot, destinationRoot, policy) {
  const sourceRemote = runGit(sourceRoot, ["remote", "get-url", "origin"]);
  if (repositorySlug(sourceRemote) !== policy.sourceRepository.toLowerCase()) {
    throw new Error(`Source origin must be ${policy.sourceRepository}; found ${sourceRemote}`);
  }
  const destinationRemote = runGit(destinationRoot, ["remote", "get-url", "origin"]);
  if (repositorySlug(destinationRemote) !== policy.destinationRepository.toLowerCase()) {
    throw new Error(`Destination origin must be ${policy.destinationRepository}; found ${destinationRemote}`);
  }
}

function repositorySlug(remote) {
  const normalized = remote.trim().replace(/\\/gu, "/").replace(/\.git$/u, "");
  const match = normalized.match(/(?:github\.com[/:])([^/]+\/[^/]+)$/iu);
  return match?.[1]?.toLowerCase() ?? "";
}

function gitRevision(root) {
  return runGit(root, ["rev-parse", "HEAD"]);
}

function gitStatus(root) {
  return runGit(root, ["status", "--porcelain"]);
}

function runGit(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not inspect Git checkout at ${root}: ${message}`);
  }
}

async function readOptionalRegularFile(path) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Projection destination must be a regular file: ${path}`);
    return await readFile(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeAtomically(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.chatobby-docs-${process.pid}.tmp`;
  let ownsTemporary = false;
  try {
    await writeFile(temporary, contents, { flag: "wx" });
    ownsTemporary = true;
    await rename(temporary, path);
  } finally {
    if (ownsTemporary) await rm(temporary, { force: true });
  }
}

async function validateRoot(root, label) {
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Public documentation ${label} must be a real directory`);
  return realpath(root);
}

async function validateProjectionPath(root, rootReal, path, required) {
  let current = root;
  const segments = path.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index]);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        if (required) throw new Error(`Projection source is missing: ${path}`);
        return;
      }
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error(`Public documentation projection rejects symbolic-link or junction paths: ${path}`);
    const resolved = await realpath(current);
    const relation = relative(rootReal, resolved);
    if (relation.startsWith("..") || isAbsolute(relation)) {
      throw new Error(`Public documentation projection path escapes its checkout: ${path}`);
    }
    const leaf = index === segments.length - 1;
    if (!leaf && !info.isDirectory()) throw new Error(`Public documentation projection parent is not a directory: ${path}`);
    if (leaf && !info.isFile()) throw new Error(`Public documentation projection target is not a regular file: ${path}`);
  }
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function parseArguments(args) {
  let destination;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") apply = true;
    else if (argument === "--dry-run") apply = false;
    else if (argument === "--destination") destination = args[index += 1];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!destination) {
    throw new Error("Usage: node scripts/project-public-documentation.mjs --destination <absolute-public-checkout> [--dry-run|--apply]");
  }
  return { destination, apply };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = parseArguments(process.argv.slice(2));
  const receipt = await projectPublicDocumentation({
    repositoryRoot: defaultRepositoryRoot,
    destination: args.destination,
    apply: args.apply,
    verifyCheckout: true,
  });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
