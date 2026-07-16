import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const releaseRoot = resolve(process.argv[2] ?? join(repositoryRoot, "release"));
const expectedAssets = ["main.js", "manifest.json", "styles.css"];
const actualAssets = readdirSync(releaseRoot).sort();
const failures = [];

if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
  failures.push(`release directory must contain exactly ${expectedAssets.join(", ")}; found ${actualAssets.join(", ")}`);
}

for (const name of actualAssets) {
  const path = join(releaseRoot, name);
  if (!statSync(path).isFile()) failures.push(`${name} is not a regular file`);
}

const pluginManifest = readJson(join(releaseRoot, "manifest.json"));
const packageManifest = readJson(join(repositoryRoot, "package.json"));
if (!/^\d+\.\d+\.\d+$/.test(pluginManifest.version ?? "")) {
  failures.push("manifest.json version must use x.y.z semantic versioning");
}
if (pluginManifest.version !== packageManifest.version) {
  failures.push(`manifest.json version ${pluginManifest.version} does not match package version ${packageManifest.version}`);
}

const textAssets = actualAssets.filter((name) => /\.(?:js|json|css)$/.test(name));
const forbiddenPatterns = [
  { label: "inline or linked source map", pattern: /sourceMappingURL|sourcesContent/ },
  { label: "private key material", pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/ },
  { label: "runtime signing key configuration", pattern: /CHATOBBY_RUNTIME_SIGNING_KEY/ },
  { label: "Chatobby development checkout path", pattern: /C:[\\/]chatobby(?:[\\/]|$)/i },
  { label: "live vault checkout path", pattern: /C:[\\/]Final_Updated_Second_Brain(?:[\\/]|$)/i },
  { label: "Windows user profile path", pattern: /[A-Za-z]:[\\/]Users[\\/][^\\/"'\s]+/ },
  { label: "Unix user profile path", pattern: /\/(?:Users|home)\/[^/"'\s]+/ },
  {
    label: "provider or service token",
    pattern: /(?:^|[^A-Za-z0-9_-])(?:sk-(?:ant-|proj-)?|ghp_|github_pat_|xox[baprs]-|AIza)[A-Za-z0-9_-]{20,}/m,
  },
];

for (const name of textAssets) {
  const source = readFileSync(join(releaseRoot, name), "utf8");
  for (const entry of forbiddenPatterns) {
    if (entry.pattern.test(source)) failures.push(`${name} contains ${entry.label}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Verified release assets in ${basename(releaseRoot)}.`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${basename(path)} is missing or invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}
