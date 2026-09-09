import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deployDevVault, registerDevVault } from "./dev-vault.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(repositoryRoot, "ci-artifacts", "connector");
const artifactNames = ["main.js", "manifest.json", "styles.css"];

export async function prepareCiConnectorArtifact(input = {}) {
  const sourceRoot = resolve(input.sourceRoot ?? repositoryRoot);
  const destinationRoot = resolve(input.outputRoot ?? outputRoot);
  const revision = input.revision ?? await gitRevision(repositoryRoot);
  await rm(destinationRoot, { recursive: true, force: true });
  await mkdir(destinationRoot, { recursive: true });

  const files = [];
  for (const name of artifactNames) {
    const source = join(sourceRoot, name);
    const destination = join(destinationRoot, name);
    await copyFile(source, destination);
    const [sourceBytes, copiedBytes] = await Promise.all([readFile(source), readFile(destination)]);
    const sourceSha256 = sha256(sourceBytes);
    const installedSha256 = sha256(copiedBytes);
    if (sourceSha256 !== installedSha256) throw new Error(`CI artifact copy hash mismatch for ${name}`);
    files.push({ name, bytes: copiedBytes.byteLength, sha256: installedSha256 });
  }

  const vaultRoot = await mkdtemp(join(tmpdir(), "chatobby-ci-vault-install-"));
  try {
    const pluginDirectory = join(vaultRoot, ".obsidian", "plugins", "chatobby");
    await mkdir(join(vaultRoot, ".obsidian"), { recursive: true });
    await mkdir(join(pluginDirectory, "runtime"), { recursive: true });
    await writeFile(join(pluginDirectory, "data.json"), "ci-preserve-settings\n");
    await writeFile(join(pluginDirectory, "runtime", "current.json"), "ci-preserve-runtime\n");
    await registerDevVault({ vaultRoot, confirmDisposable: true });
    const installation = await deployDevVault({
      repositoryRoot: destinationRoot,
      vaultRoot,
      includeManifest: true,
      reload: false,
    }, {
      build: async () => undefined,
      gitState: async () => ({ revision, dirty: false, changedPaths: 0 }),
    });
    const installedNames = installation.artifacts.map((artifact) => artifact.name).sort();
    if (JSON.stringify(installedNames) !== JSON.stringify([...artifactNames].sort())) {
      throw new Error("Temporary-vault installation did not install the exact connector artifact set");
    }
    for (const artifact of installation.artifacts) {
      if (artifact.sourceSha256 !== artifact.installedSha256) {
        throw new Error(`Temporary-vault installation hash mismatch for ${artifact.name}`);
      }
    }
    if ((await readFile(join(pluginDirectory, "data.json"), "utf8")) !== "ci-preserve-settings\n") {
      throw new Error("Temporary-vault installation changed data.json");
    }
    if ((await readFile(join(pluginDirectory, "runtime", "current.json"), "utf8")) !== "ci-preserve-runtime\n") {
      throw new Error("Temporary-vault installation changed runtime state");
    }
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }

  const receipt = {
    schemaVersion: 1,
    product: "Chatobby connector CI artifact",
    sourceRevision: revision,
    officialArtifactNames: artifactNames,
    files,
    temporaryVaultInstallContract: {
      passed: true,
      preservedPluginData: true,
      preservedRuntimeState: true,
      reloadPerformed: false,
    },
  };
  await writeFile(
    join(destinationRoot, "connector-artifact-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
  return { outputRoot: destinationRoot, receipt };
}

async function gitRevision(root) {
  const result = await run("git", ["rev-parse", "HEAD"], root);
  if (result.exitCode !== 0) throw new Error(`Could not read connector revision: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => resolvePromise({ exitCode: exitCode ?? 1, stdout, stderr }));
  });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await prepareCiConnectorArtifact();
  console.log(`Prepared exact connector CI artifact: ${result.outputRoot}`);
  for (const file of result.receipt.files) console.log(`${file.name}: sha256=${file.sha256}`);
  console.log("Temporary-vault file-install contract: passed");
}
