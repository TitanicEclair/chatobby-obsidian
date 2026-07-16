import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const backendRoot = process.env.CHATOBBY_BACKEND_ROOT;
if (!backendRoot) {
  throw new Error("Set CHATOBBY_BACKEND_ROOT to the pi-mono checkout before running this check");
}

const backendCli = resolve(backendRoot, "packages/chatobby/dist/cli.js");
const backendVendor = resolve(backendRoot, "vendor/chatobby-client");
const pluginVendor = resolve("src/vendor/chatobby-client");

if (!existsSync(backendCli)) {
  throw new Error(`Compiled backend entry point not found: ${backendCli}`);
}

const backendFiles = listFiles(backendVendor);
const pluginFiles = listFiles(pluginVendor);
if (JSON.stringify(backendFiles) !== JSON.stringify(pluginFiles)) {
  throw new Error("Vendored client file lists differ; run npm run build:vendor in pi-mono and sync the plugin copy");
}

for (const relativePath of backendFiles) {
  const backendHash = hashFile(resolve(backendVendor, relativePath));
  const pluginHash = hashFile(resolve(pluginVendor, relativePath));
  if (backendHash !== pluginHash) {
    throw new Error(`Vendored client differs from the current backend: ${relativePath}`);
  }
}

console.log(`Backend CLI: ${backendCli}`);
console.log(`Verified ${backendFiles.length} browser-client files against ${backendVendor}`);

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
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
