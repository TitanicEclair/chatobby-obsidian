import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const failures = [];

async function collectCss(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectCss(path));
    else if (extname(entry.name) === ".css") files.push(path);
  }
  return files;
}

for (const file of await collectCss(sourceRoot)) {
  const source = await readFile(file, "utf8");
  if (source.includes("!important")) failures.push(`${file}: avoid !important declarations`);
}

const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
if (typeof manifest.description !== "string" || !/[.!?]$/.test(manifest.description.trim())) {
  failures.push("manifest.json: description must end with punctuation");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Review source checks passed.");
}
