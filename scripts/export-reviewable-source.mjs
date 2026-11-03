import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const defaultRepositoryRoot = resolve(import.meta.dirname, "..");
const inventoryName = "reviewable-export-inventory.json";
const reservedOutputs = new Set([inventoryName, "publication-gaps.json"]);

/** Export HEAD's allowlisted Git blobs, never staged, untracked or working-tree bytes. */
export async function exportReviewableSource({ repositoryRoot, destination, draft = false }) {
  if (!isAbsolute(destination)) throw new Error("Reviewable export destination must be absolute");
  const sourceRoot = resolve(repositoryRoot);
  const outputRoot = resolve(destination);
  if (contains(sourceRoot, outputRoot) || contains(outputRoot, sourceRoot)) {
    throw new Error("Reviewable export destination must not overlap the live plugin repository");
  }
  if (resolve(git(sourceRoot, ["rev-parse", "--show-toplevel"]).toString("utf8").trim()) !== sourceRoot) {
    throw new Error("Reviewable export source must be the repository root");
  }
  const sourceRevision = git(sourceRoot, ["rev-parse", "--verify", "HEAD^{commit}"]).toString("utf8").trim();
  const entries = git(sourceRoot, ["ls-tree", "--full-tree", "-rz", sourceRevision]).toString("utf8")
    .split("\0").filter(Boolean).map((line) => {
      const match = /^(\d+) (blob|commit) ([a-f0-9]+)\t(.+)$/u.exec(line);
      if (!match) throw new Error("Invalid committed export tree entry");
      return { path: match[4], mode: match[1], gitBlob: match[3] };
    });
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const policyEntry = byPath.get("boundary-manifest.json");
  if (!policyEntry) throw new Error("Committed boundary-manifest.json is missing");
  assertRegularBlob(policyEntry);
  const policyBytes = git(sourceRoot, ["cat-file", "blob", policyEntry.gitBlob]);
  const manifest = JSON.parse(policyBytes.toString("utf8"));
  validateReviewableExportManifest(manifest);

  const publicationGaps = manifest.requiredPublicationFiles.filter((path) => !byPath.has(path));
  if (!draft && publicationGaps.length > 0) {
    throw new Error(`Reviewable export is blocked by missing publication files: ${publicationGaps.join(", ")}`);
  }
  for (const path of manifest.reviewableExportFiles) {
    if (!byPath.has(path)) throw new Error(`Committed reviewable export file is missing: ${path}`);
  }
  for (const root of manifest.reviewableExportRoots) {
    if (!entries.some((entry) => entry.path.startsWith(`${root}/`))) {
      throw new Error(`Committed reviewable export root is missing: ${root}`);
    }
  }
  const explicitFiles = new Set([...manifest.reviewableExportFiles, ...manifest.requiredPublicationFiles]);
  const excludedCounts = {};
  const selected = [];
  const names = new Set();
  for (const entry of entries) {
    const path = entry.path;
    if (!explicitFiles.has(path) && !manifest.reviewableExportRoots.some((root) => path.startsWith(`${root}/`)) &&
      !/^RELEASE_NOTES_\d+\.\d+\.\d+\.md$/u.test(path)) continue;
    validatePath(path);
    const reason = exclusionReason(path, manifest);
    if (reason) {
      if (explicitFiles.has(path)) throw new Error(`Required export path is excluded: ${path}`);
      excludedCounts[reason] = (excludedCounts[reason] ?? 0) + 1;
      continue;
    }
    assertRegularBlob(entry);
    const name = path.toLowerCase();
    if (names.has(name) || reservedOutputs.has(name)) throw new Error(`Colliding reviewable export path: ${path}`);
    names.add(name);
    selected.push(entry);
  }
  selected.sort(comparePaths);
  const blobs = readBlobs(sourceRoot, selected);
  const files = selected.map((entry, index) => {
    const bytes = blobs[index];
    if (hasSourceMapDirective(entry.path, bytes)) {
      throw new Error(`Reviewable export contains a source map directive: ${entry.path}`);
    }
    return { ...entry, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const inventory = {
    schemaVersion: 1,
    sourceRevision,
    boundaryManifest: { gitBlob: policyEntry.gitBlob, sha256: sha256(policyBytes) },
    files,
    excludedCounts: Object.fromEntries(Object.entries(excludedCounts).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)),
    publicationGaps,
  };

  // Validate all committed inputs before writing. Never recursively erase an arbitrary destination.
  await requireFreshDestination(outputRoot);
  const directories = [...new Set(files.map((file) => dirname(join(outputRoot, file.path))))];
  for (const directory of directories) await mkdir(directory, { recursive: true });
  for (let start = 0; start < files.length; start += 8) {
    const results = await Promise.allSettled(files.slice(start, start + 8).map(async (file, offset) => {
      const target = join(outputRoot, file.path);
      await writeFile(target, blobs[start + offset], { flag: "wx", mode: file.mode === "100755" ? 0o755 : 0o644 });
      if (sha256(await readFile(target)) !== file.sha256) throw new Error(`Copied export bytes differ: ${file.path}`);
    }));
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }
  if (draft && publicationGaps.length > 0) {
    await writeFile(join(outputRoot, "publication-gaps.json"), json({ sourceRevision, missing: publicationGaps }), { flag: "wx" });
  }
  // Written last: absence of this receipt means the export did not finish.
  await writeFile(join(outputRoot, inventoryName), json(inventory), { flag: "wx" });
  return { destination: outputRoot, sourceRevision, publicationGaps, inventory: inventoryName, files: files.length };
}

/** Shared with the boundary check; paths are literal repository paths, never globs. */
export function validateReviewableExportManifest(manifest) {
  if (manifest?.schemaVersion !== 1) throw new Error("Unsupported reviewable export schemaVersion");
  for (const field of ["reviewableExportFiles", "reviewableExportRoots", "requiredPublicationFiles", "excludedExportPaths"]) {
    if (!Array.isArray(manifest[field]) || manifest[field].length === 0) throw new Error(`${field} must be a non-empty array`);
    const paths = new Set();
    for (const path of manifest[field]) {
      validatePath(path);
      if (paths.has(path.toLowerCase())) throw new Error(`Duplicate ${field} path: ${path}`);
      paths.add(path.toLowerCase());
    }
  }
  // Historical schema-1 commits lack the additive recursive list. Their declared local-state
  // basenames still apply recursively; generated root artifacts deliberately remain root-only.
  const recursive = manifest.recursiveExcludedExportNames ?? manifest.excludedExportPaths.filter(
    (path) => [".git", "data.json", "node_modules", ".chatobby-mcp-replies"].includes(path),
  );
  if (!Array.isArray(recursive)) throw new Error("recursiveExcludedExportNames must be an array");
  for (const name of recursive) {
    validatePath(name);
    if (name.includes("/")) throw new Error("recursiveExcludedExportNames entries must be basenames");
  }
  if (new Set(recursive.map((name) => name.toLowerCase())).size !== recursive.length) throw new Error("Duplicate recursive export exclusion");
  for (const required of [".git", "data.json", "node_modules"]) {
    if (!recursive.some((name) => name.toLowerCase() === required)) throw new Error(`Missing recursive export exclusion: ${required}`);
  }
  manifest.recursiveExcludedExportNames = recursive;
}

function exclusionReason(path, manifest) {
  const name = path.toLowerCase();
  if (manifest.excludedExportPaths.some((entry) => name === entry.toLowerCase() || name.startsWith(`${entry.toLowerCase()}/`))) return "excluded repository path";
  if (path.split("/").some((part) => manifest.recursiveExcludedExportNames.some((entry) => part.toLowerCase() === entry.toLowerCase()))) return "excluded recursive name";
  if (path.split("/").some((part) => /^\.env(?:\.|$)/iu.test(part))) return "environment file";
  if (/\.map$/iu.test(path)) return "source map";
  return null;
}

function validatePath(path) {
  if (typeof path !== "string" || path.length === 0 || /[\\:\x00-\x1f]/u.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === ".." || /[. ]$/u.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))) {
    throw new Error(`Invalid reviewable export path: ${String(path)}`);
  }
}

function assertRegularBlob(entry) {
  if (entry.mode !== "100644" && entry.mode !== "100755") throw new Error(`Reviewable export has unsupported Git mode ${entry.mode}: ${entry.path}`);
}

function hasSourceMapDirective(path, bytes) {
  if (!/\.(?:[cm]?js|[cm]?ts|tsx|jsx|css)$/iu.test(path)) return false;
  const source = bytes.toString("utf8");
  if (!source.includes("sourceMappingURL")) return false;
  const directive = /^\/(?:\/[#@]|\*[#@])\s*sourceMappingURL\s*=/u;
  if (/\.css$/iu.test(path)) {
    let quote = null;
    for (let index = 0; index < source.length; index++) {
      const char = source[index];
      if (char === "\\") { index++; continue; }
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === "/" && source[index + 1] === "*") {
        const end = source.indexOf("*/", index + 2);
        if (directive.test(source.slice(index, end < 0 ? source.length : end + 2))) return true;
        index = end < 0 ? source.length : end + 1;
      }
    }
    return false;
  }
  // Existing TypeScript parsing distinguishes comments from fixture strings/regex literals.
  // Checking both sides of each node also catches a directive after code on the same line.
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    const comments = [...(ts.getLeadingCommentRanges(source, node.pos) ?? []), ...(ts.getTrailingCommentRanges(source, node.end) ?? [])];
    if (comments.some(({ pos, end }) => directive.test(source.slice(pos, end)))) return true;
    return ts.forEachChild(node, visit) ?? false;
  }
  return visit(file);
}

function readBlobs(root, entries) {
  const data = git(root, ["cat-file", "--batch"], entries.map((entry) => entry.gitBlob).join("\n") + "\n");
  let offset = 0;
  return entries.map((entry) => {
    const end = data.indexOf(10, offset);
    const header = data.subarray(offset, end).toString("utf8");
    const match = /^([a-f0-9]+) blob (\d+)$/u.exec(header);
    if (!match || match[1] !== entry.gitBlob) throw new Error(`Invalid Git blob response: ${entry.path}`);
    const start = end + 1;
    const finish = start + Number(match[2]);
    if (finish >= data.length || data[finish] !== 10) throw new Error(`Incomplete Git blob: ${entry.path}`);
    offset = finish + 1;
    return data.subarray(start, finish);
  });
}

function git(root, args, input) {
  return execFileSync("git", ["-C", root, ...args], { input, maxBuffer: 128 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
}

async function requireFreshDestination(outputRoot) {
  for (let current = outputRoot;; current = dirname(current)) {
    const state = await lstat(current).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (state && (!state.isDirectory() || state.isSymbolicLink())) throw new Error("Reviewable export destination must use regular directories");
    if (dirname(current) === current) break;
  }
  await mkdir(outputRoot, { recursive: true });
  if ((await readdir(outputRoot)).length !== 0) throw new Error("Reviewable export destination must be empty");
}

function contains(parent, child) {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}
function comparePaths(left, right) { return left.path < right.path ? -1 : left.path > right.path ? 1 : 0; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const draft = args.includes("--draft");
  const destination = args.find((arg) => arg !== "--draft");
  if (!destination || args.length !== (draft ? 2 : 1)) throw new Error("Usage: node scripts/export-reviewable-source.mjs <absolute-destination> [--draft]");
  const result = await exportReviewableSource({ repositoryRoot: defaultRepositoryRoot, destination, draft });
  process.stdout.write(json(result));
}
