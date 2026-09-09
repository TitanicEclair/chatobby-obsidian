import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function checkConnectorProductIdentity(root = defaultRoot) {
  const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const obsidianManifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  const versions = JSON.parse(await readFile(join(root, "versions.json"), "utf8"));
  const generated = await readFile(join(root, "src", "vendor", "chatobby-client", "control", "product.generated.ts"), "utf8");
  const match = generated.match(/CHATOBBY_PRODUCT_VERSION\s*=\s*["']([^"']+)["']/u);
  if (typeof packageManifest.version !== "string" || packageManifest.version !== obsidianManifest.version) {
    throw new Error("Connector package and manifest versions are not exact");
  }
  if (match?.[1] !== packageManifest.version) throw new Error("Generated connector product identity does not match package N");
  if (versions[packageManifest.version] !== obsidianManifest.minAppVersion) {
    throw new Error("Connector versions.json does not contain exact product N and its minimum Obsidian version");
  }
  return { version: packageManifest.version, minimumObsidian: obsidianManifest.minAppVersion };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkConnectorProductIdentity();
  process.stdout.write(`Connector product identity ${result.version} is coherent.\n`);
}
