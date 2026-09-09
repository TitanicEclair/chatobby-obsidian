import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectionRoot = join(repositoryRoot, "src", "vendor", "chatobby-client");
const manifestPath = join(projectionRoot, "projection.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.schemaVersion !== 1 || manifest.artifact !== "chatobby-client") fail("Generated client receipt identity is invalid");
if (manifest.contractSurface !== "complete-package-entry-closure") fail("Generated client receipt does not cover the complete package entry closure");
if (manifest.protocolVersion !== 2) fail("Connector requires frontend protocol v2");
if (!/^[a-f0-9]{40,64}$/u.test(manifest.sourceRevision)) fail("Canonical source revision is missing or invalid");
if (!Array.isArray(manifest.sourceFiles) || manifest.sourceFiles.length === 0) fail("Canonical source inventory is empty");
validateInventory("canonical source", manifest.sourceFiles, false);
const sourceContentSha256 = sha256(Buffer.from(JSON.stringify(manifest.sourceFiles)));
if (sourceContentSha256 !== manifest.sourceContentSha256) fail("Canonical source content hash does not match its complete inventory");

if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail("Generated client file inventory is empty");
validateInventory("generated client", manifest.files, true);
const actualFiles = (await walk(projectionRoot))
	.filter((path) => path !== manifestPath)
	.map((path) => relative(projectionRoot, path).split(sep).join("/"));
const expectedFiles = manifest.files.map((item) => item.path);
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) fail("Generated client file set drifted from the receipt");

for (const item of manifest.files) {
	const path = join(projectionRoot, ...item.path.split("/"));
	const bytes = await readFile(path);
	const state = await stat(path);
	if (!state.isFile() || state.size !== item.size || sha256(bytes) !== item.sha256) {
		fail(`Generated client file drifted: ${item.path}`);
	}
}

const contracts = await readFile(join(projectionRoot, "frontend-contracts.ts"), "utf8");
const client = await readFile(join(projectionRoot, "ws-client.ts"), "utf8");
if (!contracts.includes("CHATOBBY_FRONTEND_PROTOCOL_VERSION = 2")) fail("Generated contract does not declare frontend protocol v2");
if (/method: "frontend_bootstrap"|getFrontendBootstrap/u.test(`${contracts}\n${client}`)) fail("Removed frontend_bootstrap API exists in the generated client");
for (const parser of ["parseFrontendPatch", "parseFrontendSubscriptionResult", "parseFrontendScreenResponse", "parseFrontendIntentResult", "parseFrontendProtocolError"]) {
	if (!contracts.includes(parser) && !client.includes(parser)) fail(`Generated boundary parser is missing: ${parser}`);
}

console.log(`Verified complete chatobby-client projection from ${manifest.sourceRevision} (${manifest.sourceContentSha256}).`);

function validateInventory(label, items, requireSize) {
	const paths = items.map((item) => item.path);
	const sorted = [...paths].sort((left, right) => left.localeCompare(right));
	if (new Set(paths).size !== paths.length || JSON.stringify(paths) !== JSON.stringify(sorted)) fail(`${label} inventory is not unique and sorted`);
	for (const item of items) {
		if (typeof item.path !== "string" || item.path.length === 0 || item.path.startsWith("/") || item.path.includes("..")) fail(`${label} contains an unsafe path`);
		if (!/^[a-f0-9]{64}$/u.test(item.sha256)) fail(`${label} contains an invalid SHA-256`);
		if (requireSize && (!Number.isSafeInteger(item.size) || item.size < 1)) fail(`${label} contains an invalid file size`);
	}
}

async function walk(root) {
	const paths = [];
	for (const entry of await readdir(root, { withFileTypes: true })) {
		const path = join(root, entry.name);
		if (entry.isSymbolicLink()) fail(`Generated client contains a symbolic link: ${path}`);
		if (entry.isDirectory()) paths.push(...await walk(path));
		else if (entry.isFile()) paths.push(path);
	}
	return paths.sort((left, right) => left.localeCompare(right));
}

function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

function fail(message) {
	throw new Error(message);
}
