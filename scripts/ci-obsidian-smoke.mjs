import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deployDevVault, obsidianVaultCommand } from "./dev-vault.mjs";

const expectedArtifacts = ["main.js", "manifest.json", "styles.css"];
const expectedRepository = "TitanicEclair/chatobby";
const trustedRefs = [/^refs\/heads\/(?:dev|main)$/u, /^refs\/heads\/release\//u];

export async function runCiObsidianSmoke(input) {
  validateCiObsidianSmokeInvocation(input.environment ?? process.env);
  const artifactRoot = absolutePath(input.artifactRoot, "artifact root");
  const vaultRoot = absolutePath(input.vaultRoot, "vault root");
  const diagnosticsRoot = absolutePath(input.diagnosticsRoot, "diagnostics root");
  const receipt = await verifyCiConnectorArtifactReceipt(
    artifactRoot,
    input.environment?.GITHUB_SHA ?? process.env.GITHUB_SHA,
  );
  await mkdir(diagnosticsRoot, { recursive: true });
  const vaultName = input.vaultName?.trim() || basename(vaultRoot);
  const obsidianCli = input.obsidianCli?.trim() || (process.platform === "win32" ? "Obsidian.com" : "obsidian");

  const deployment = await deployDevVault({
    repositoryRoot: artifactRoot,
    vaultRoot,
    vaultName,
    obsidianCli,
    includeManifest: true,
    reload: true,
  }, {
    build: async () => undefined,
    gitState: async () => ({ revision: receipt.sourceRevision, dirty: false, changedPaths: 0 }),
  });

  const plugin = await runChecked(
    obsidianCli,
    obsidianVaultCommand(vaultName, ["plugin", "id=chatobby"]),
    artifactRoot,
  );
  await runChecked(
    obsidianCli,
    obsidianVaultCommand(vaultName, ["command", "id=chatobby:open"]),
    artifactRoot,
  );
  const dom = await runChecked(
    obsidianCli,
    obsidianVaultCommand(vaultName, ["dev:dom", "selector=.chatobby-view", "total"]),
    artifactRoot,
  );
  if (!/[1-9]\d*/u.test(dom.stdout)) throw new Error("Chatobby view did not appear in the disposable Obsidian DOM");
  const screenshotPath = join(diagnosticsRoot, "chatobby-ci-smoke.png");
  await runChecked(
    obsidianCli,
    obsidianVaultCommand(vaultName, ["dev:screenshot", `path=${screenshotPath}`]),
    artifactRoot,
  );
  const errors = await runChecked(
    obsidianCli,
    obsidianVaultCommand(vaultName, ["dev:errors"]),
    artifactRoot,
  );
  const result = {
    schemaVersion: 1,
    sourceRevision: receipt.sourceRevision,
    vaultName,
    artifactHashes: deployment.artifacts.map((artifact) => ({
      name: artifact.name,
      sha256: artifact.installedSha256,
    })),
    plugin: plugin.stdout.trim(),
    dom: dom.stdout.trim(),
    developerErrors: errors.stdout.trim(),
    screenshot: screenshotPath,
  };
  await writeFile(join(diagnosticsRoot, "chatobby-ci-smoke.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  if (result.developerErrors) throw new Error(`Fresh Obsidian developer errors were reported:\n${result.developerErrors}`);
  return result;
}

export function validateCiObsidianSmokeInvocation(environment) {
  if (environment.GITHUB_EVENT_NAME !== "push") {
    throw new Error("Live Obsidian smoke accepts only trusted push events");
  }
  if (environment.GITHUB_REPOSITORY !== expectedRepository) {
    throw new Error("Live Obsidian smoke accepts only the private connector repository");
  }
  if (!trustedRefs.some((pattern) => pattern.test(environment.GITHUB_REF ?? ""))) {
    throw new Error("Live Obsidian smoke accepts only dev, main, or release/* pushes");
  }
  if (environment.RUNNER_ENVIRONMENT !== "self-hosted") {
    throw new Error("Live Obsidian smoke requires the dedicated self-hosted runner");
  }
}

export async function verifyCiConnectorArtifactReceipt(artifactRoot, expectedRevision) {
  if (typeof expectedRevision !== "string" || !expectedRevision.trim()) {
    throw new Error("Expected connector source revision is missing");
  }
  const names = (await readdir(artifactRoot)).sort();
  const expectedNames = [...expectedArtifacts, "connector-artifact-receipt.json"].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error("Downloaded connector artifact contains an unexpected file set");
  }
  const value = JSON.parse(await readFile(join(artifactRoot, "connector-artifact-receipt.json"), "utf8"));
  if (
    value?.schemaVersion !== 1
    || value.product !== "Chatobby connector CI artifact"
    || value.sourceRevision !== expectedRevision
    || JSON.stringify(value.officialArtifactNames) !== JSON.stringify(expectedArtifacts)
    || !Array.isArray(value.files)
    || value.files.length !== expectedArtifacts.length
    || value.temporaryVaultInstallContract?.passed !== true
    || value.temporaryVaultInstallContract?.preservedPluginData !== true
    || value.temporaryVaultInstallContract?.preservedRuntimeState !== true
    || value.temporaryVaultInstallContract?.reloadPerformed !== false
  ) {
    throw new Error("Connector artifact receipt identity is invalid");
  }
  for (const name of expectedArtifacts) {
    const file = value.files.find((candidate) => candidate?.name === name);
    const bytes = await readFile(join(artifactRoot, name));
    if (
      !file
      || file.bytes !== bytes.byteLength
      || file.sha256 !== createHash("sha256").update(bytes).digest("hex")
    ) {
      throw new Error(`Connector artifact receipt hash mismatch for ${name}`);
    }
  }
  return value;
}

function absolutePath(path, label) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error(`${label} must be an absolute path`);
  return resolve(path);
}

function runChecked(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if ((exitCode ?? 1) !== 0) {
        reject(new Error(`${command} ${args.join(" ")} failed: ${[stdout.trim(), stderr.trim()].filter(Boolean).join("\n")}`));
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

function parseArguments(tokens) {
  const input = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const option = tokens[index];
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
    if (option === "--artifact-root") input.artifactRoot = value;
    else if (option === "--vault-root") input.vaultRoot = value;
    else if (option === "--vault-name") input.vaultName = value;
    else if (option === "--diagnostics-root") input.diagnosticsRoot = value;
    else if (option === "--obsidian-cli") input.obsidianCli = value;
    else throw new Error(`Unknown option: ${option}`);
    index += 1;
  }
  return input;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runCiObsidianSmoke(parseArguments(process.argv.slice(2)));
    console.log("Live disposable-Obsidian connector smoke passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
