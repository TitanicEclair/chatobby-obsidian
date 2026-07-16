import { cp, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = resolve(import.meta.dirname, "..");

/** Export only the allowlisted connector source into a fresh review directory. */
export async function exportReviewableSource({ repositoryRoot, destination, draft = false }) {
  const sourceRoot = resolve(repositoryRoot);
  const outputRoot = resolve(destination);
  if (outputRoot === sourceRoot || relative(sourceRoot, outputRoot) === "") {
    throw new Error("Reviewable export destination must not be the live plugin repository");
  }
  if (!isAbsolute(outputRoot)) throw new Error("Reviewable export destination must be absolute");

  const manifest = JSON.parse(await readFile(join(sourceRoot, "boundary-manifest.json"), "utf8"));
  const publicationGaps = [];
  for (const required of manifest.requiredPublicationFiles ?? []) {
    if (!(await pathExists(join(sourceRoot, required)))) publicationGaps.push(required);
  }
  if (!draft && publicationGaps.length > 0) {
    throw new Error(`Reviewable export is blocked by missing publication files: ${publicationGaps.join(", ")}`);
  }

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  for (const path of manifest.reviewableExportFiles ?? []) await copyAllowlisted(sourceRoot, outputRoot, path);
  for (const path of manifest.reviewableExportRoots ?? []) await copyAllowlisted(sourceRoot, outputRoot, path);
  for (const path of manifest.requiredPublicationFiles ?? []) {
    if (await pathExists(join(sourceRoot, path))) await copyAllowlisted(sourceRoot, outputRoot, path);
  }
  if (draft && publicationGaps.length > 0) {
    await writeFile(
      join(outputRoot, "publication-gaps.json"),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), missing: publicationGaps }, null, 2)}\n`,
      "utf8",
    );
  }
  return { destination: outputRoot, publicationGaps };
}

async function copyAllowlisted(sourceRoot, outputRoot, path) {
  if (path.includes("\\") || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error(`Invalid reviewable export path: ${path}`);
  }
  const source = join(sourceRoot, path);
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Reviewable export path is a symbolic link: ${path}`);
  const destination = join(outputRoot, path);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: info.isDirectory(),
    errorOnExist: true,
    filter: async (candidate) => {
      if ((await lstat(candidate)).isSymbolicLink()) {
        throw new Error(`Reviewable export contains symbolic link: ${relative(sourceRoot, candidate)}`);
      }
      return true;
    },
  });
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const draft = args.includes("--draft");
  const destination = args.find((arg) => arg !== "--draft");
  if (!destination) throw new Error("Usage: node scripts/export-reviewable-source.mjs <absolute-destination> [--draft]");
  const result = await exportReviewableSource({ repositoryRoot: defaultRepositoryRoot, destination, draft });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
