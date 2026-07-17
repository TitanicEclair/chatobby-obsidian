import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const sourceRoot = join(repositoryRoot, "src");
const manifest = JSON.parse(readFileSync(join(repositoryRoot, "boundary-manifest.json"), "utf8"));
const failures = [];

if (manifest.schemaVersion !== 1) failures.push("boundary-manifest.json has an unsupported schemaVersion");

const declaredRoots = new Map(manifest.reviewableSourceRoots.map((entry) => [entry.path, entry]));
const actualRoots = readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const root of actualRoots) {
  const declaration = declaredRoots.get(root);
  if (!declaration) {
    failures.push(`src/${root} is not classified in boundary-manifest.json`);
    continue;
  }
  if (!Array.isArray(declaration.authority)) failures.push(`src/${root} has no authority classification`);
}
for (const root of declaredRoots.keys()) {
  if (!actualRoots.includes(root)) failures.push(`boundary-manifest.json declares missing source root src/${root}`);
}

const actualRootFiles = readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
  .map((entry) => entry.name)
  .sort();
const declaredRootFiles = [...manifest.reviewableSourceFiles].sort();
if (JSON.stringify(actualRootFiles) !== JSON.stringify(declaredRootFiles)) {
  failures.push(
    `reviewable source files differ: expected ${declaredRootFiles.join(", ")}; found ${actualRootFiles.join(", ")}`,
  );
}

const forbiddenImports = new Set(manifest.forbiddenRuntimeImports);
const generatedRoots = new Set(
  manifest.reviewableSourceRoots.filter((entry) => entry.generated === true).map((entry) => join(sourceRoot, entry.path)),
);
for (const path of sourceFiles(sourceRoot)) {
  if (lstatSync(path).isSymbolicLink()) {
    failures.push(`${relative(repositoryRoot, path)} is a symbolic link`);
    continue;
  }
  const source = readFileSync(path, "utf8");
  for (const specifier of importSpecifiers(source)) {
    if (forbiddenImports.has(specifier) || [...forbiddenImports].some((entry) => specifier.startsWith(`${entry}/`))) {
      failures.push(`${relative(repositoryRoot, path)} imports private runtime package ${specifier}`);
    }
  }
  if ([...generatedRoots].some((root) => path === root || path.startsWith(`${root}\\`) || path.startsWith(`${root}/`))) {
    continue;
  }
  const relativePath = relative(repositoryRoot, path).replaceAll("\\", "/");
  for (const privateContract of ["subagent-contracts", "permission-contracts", "channel-contracts"]) {
    if (importSpecifiers(source).some((specifier) => specifier.includes(privateContract))) {
      failures.push(`${relativePath} imports private ${privateContract}`);
    }
  }
  if (/(?:node:)?child_process/.test(source) && relativePath !== "src/runtime/infrastructure/managed-process.ts") {
    failures.push(`${relativePath} contains generic subprocess execution outside managed runtime lifecycle`);
  }
  if (/\bauth\.json\b/i.test(source)) failures.push(`${relativePath} contains connector credential-file behavior`);
  if (/types\/tool-semantics|classifyTool\s*\(/.test(source)) failures.push(`${relativePath} contains connector tool-name semantics`);
  if (/\beval\s*\(|\(\s*0\s*,\s*eval\s*\)\s*\(|\b(?:new\s+)?Function\s*\(/.test(source)) {
    failures.push(`${relativePath} contains arbitrary code evaluation`);
  }
  if (/feed\.agent-event-received|applyFeedEvent|handleEvent\s*\(/.test(source)) {
    failures.push(`${relativePath} contains raw agent-event reduction`);
  }
}

const vendorRoot = join(sourceRoot, "vendor");
const actualVendorRoots = readdirSync(vendorRoot, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();
const expectedVendorRoots = ["@chatobby", "chatobby-client"];
if (JSON.stringify(actualVendorRoots) !== JSON.stringify(expectedVendorRoots)) {
	failures.push(`connector vendor roots differ: expected ${expectedVendorRoots.join(", ")}; found ${actualVendorRoots.join(", ")}`);
}

const publicClientRoot = join(vendorRoot, "chatobby-client");
const expectedPublicClientFiles = [
	"connector-types.d.ts",
	"control/contracts.d.ts",
	"frontend-contracts.d.ts",
	"wire-types.d.ts",
	"ws-client.d.ts",
	"ws-client.js",
];
const actualPublicClientFiles = sourceFiles(publicClientRoot)
	.map((path) => relative(publicClientRoot, path).replaceAll("\\", "/"))
	.sort();
if (JSON.stringify(actualPublicClientFiles) !== JSON.stringify(expectedPublicClientFiles)) {
	failures.push(
		`generated public client differs: expected ${expectedPublicClientFiles.join(", ")}; found ${actualPublicClientFiles.join(", ")}`,
	);
}
for (const path of sourceFiles(publicClientRoot)) {
	const source = readFileSync(path, "utf8");
	for (const privateContract of ["subagent-contracts", "permission-contracts", "channel-contracts", "ws-types"]) {
		if (importSpecifiers(source).some((specifier) => specifier.includes(privateContract))) {
			failures.push(
				`generated public client ${relative(publicClientRoot, path).replaceAll("\\", "/")} imports private ${privateContract}`,
			);
		}
	}
}

if (!manifest.excludedExportPaths.includes("data.json")) {
  failures.push("data.json must remain excluded from every reviewable export");
}
const expectedAssets = ["main.js", "manifest.json", "styles.css"];
if (JSON.stringify([...manifest.officialReleaseAssets].sort()) !== JSON.stringify(expectedAssets)) {
  failures.push("officialReleaseAssets must contain only main.js, manifest.json, and styles.css");
}
for (const field of ["reviewableExportFiles", "reviewableExportRoots", "requiredPublicationFiles"]) {
  if (!Array.isArray(manifest[field]) || manifest[field].length === 0) {
    failures.push(`boundary-manifest.json ${field} must be a non-empty array`);
  }
}
for (const path of [...(manifest.reviewableExportFiles ?? []), ...(manifest.reviewableExportRoots ?? [])]) {
  if (!lstatSync(join(repositoryRoot, path), { throwIfNoEntry: false })) {
    failures.push(`reviewable export path is missing: ${path}`);
  }
}
for (const path of manifest.requiredPublicationFiles ?? []) {
	if (!lstatSync(join(repositoryRoot, path), { throwIfNoEntry: false })) {
		failures.push(`required publication file is missing: ${path}`);
	}
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Reviewable connector boundary check passed.");
}

function sourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.isFile() && /\.(?:ts|js|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function importSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g)) {
    if (match[1]) specifiers.push(match[1]);
  }
  for (const match of source.matchAll(/(?:import|require)\(\s*["']([^"']+)["']\s*\)/g)) {
    if (match[1]) specifiers.push(match[1]);
  }
  return specifiers;
}
