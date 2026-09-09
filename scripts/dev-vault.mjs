import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ID = "chatobby";
const MARKER_FILENAME = ".chatobby-dev-vault.json";
const MARKER_PURPOSE = "chatobby-disposable-development-vault";
const MARKER_SCHEMA_VERSION = 1;
const DEFAULT_OBSIDIAN_CLI = process.platform === "win32" ? "Obsidian.com" : "obsidian";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function obsidianVaultCommand(vaultName, commandArguments) {
  return [`vault=${vaultName}`, ...commandArguments];
}

export async function registerDevVault(input) {
  if (input.confirmDisposable !== true) {
    throw new Error(
      "Registration requires --confirm-disposable. Register only a dedicated disposable development vault, never a main vault.",
    );
  }

  const vault = await resolveVault(input.vaultRoot);
  const markerPath = join(vault.obsidianDirectory, MARKER_FILENAME);
  const marker = {
    schemaVersion: MARKER_SCHEMA_VERSION,
    purpose: MARKER_PURPOSE,
    pluginId: PLUGIN_ID,
    vaultRoot: vault.root,
    registeredAt: new Date().toISOString(),
  };

  try {
    const existing = await readMarker(markerPath);
    assertMarkerMatches(existing, vault.root);
    return { created: false, markerPath, vaultRoot: vault.root };
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }

  await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return { created: true, markerPath, vaultRoot: vault.root };
}

export async function deployDevVault(input, dependencyOverrides = {}) {
  const dependencies = createDependencies(dependencyOverrides);
  const startedAt = performance.now();
  const vault = await resolveVault(input.vaultRoot);
  const markerPath = join(vault.obsidianDirectory, MARKER_FILENAME);
  const marker = await readMarker(markerPath);
  assertMarkerMatches(marker, vault.root);

  const pluginsDirectory = join(vault.obsidianDirectory, "plugins");
  const pluginDirectory = join(pluginsDirectory, PLUGIN_ID);
  await assertSafeOptionalDirectory(pluginsDirectory, "Vault plugins directory");
  await assertSafeOptionalDirectory(pluginDirectory, "Chatobby plugin directory");

  const sourceState = await dependencies.gitState(input.repositoryRoot);
  const buildStartedAt = performance.now();
  await dependencies.build(input.repositoryRoot);
  const buildMs = performance.now() - buildStartedAt;

  const artifactNames = input.includeManifest === true
    ? ["main.js", "styles.css", "manifest.json"]
    : ["main.js", "styles.css"];
  const artifacts = await describeSourceArtifacts(
    input.repositoryRoot,
    pluginDirectory,
    artifactNames,
    dependencies,
  );

  const copyStartedAt = performance.now();
  const transaction = await installArtifacts(artifacts, pluginDirectory, dependencies);
  let reloadAttempted = false;
  try {
    for (const artifact of artifacts) {
      artifact.installedSha256 = await dependencies.hashFile(artifact.targetPath);
      if (artifact.installedSha256 !== artifact.sourceSha256) {
        throw new Error(`Installed hash mismatch for ${artifact.name}`);
      }
    }
    const copyMs = performance.now() - copyStartedAt;

    let developerErrors = "";
    let reloadMs = 0;
    const reload = input.reload !== false;
    const vaultName = input.vaultName?.trim() || basename(vault.root);
    if (reload) {
      const reloadStartedAt = performance.now();
      await dependencies.runObsidian(
        input.obsidianCli,
        obsidianVaultCommand(vaultName, ["dev:errors", "clear"]),
        input.repositoryRoot,
      );
      reloadAttempted = true;
      await dependencies.runObsidian(
        input.obsidianCli,
        obsidianVaultCommand(vaultName, ["plugin:reload", `id=${PLUGIN_ID}`]),
        input.repositoryRoot,
      );
      const errorResult = await dependencies.runObsidian(
        input.obsidianCli,
        obsidianVaultCommand(vaultName, ["dev:errors"]),
        input.repositoryRoot,
      );
      developerErrors = joinProcessOutput(errorResult);
      reloadMs = performance.now() - reloadStartedAt;
    }

    await transaction.commit();
    return {
      vaultRoot: vault.root,
      pluginDirectory,
      markerPath,
      sourceState,
      artifacts: artifacts.map((artifact) => ({
        name: artifact.name,
        bytes: artifact.bytes,
        sourceSha256: artifact.sourceSha256,
        installedSha256: artifact.installedSha256,
      })),
      reload,
      developerErrors,
      timingsMs: {
        build: roundedMilliseconds(buildMs),
        copyAndVerify: roundedMilliseconds(copyMs),
        reloadAndErrors: roundedMilliseconds(reloadMs),
        total: roundedMilliseconds(performance.now() - startedAt),
      },
    };
  } catch (error) {
    const rollbackErrors = await transaction.rollback();
    let recoveryReloadError;
    if (reloadAttempted) {
      const vaultName = input.vaultName?.trim() || basename(vault.root);
      try {
        await dependencies.runObsidian(
          input.obsidianCli,
          obsidianVaultCommand(vaultName, ["plugin:reload", `id=${PLUGIN_ID}`]),
          input.repositoryRoot,
        );
      } catch (reloadError) {
        recoveryReloadError = errorMessage(reloadError);
      }
    }
    throw deploymentError(error, rollbackErrors, recoveryReloadError);
  }
}

function createDependencies(overrides) {
  return {
    build: overrides.build ?? buildDevelopmentBundle,
    gitState: overrides.gitState ?? readGitState,
    hashFile: overrides.hashFile ?? sha256File,
    renameFile: overrides.renameFile ?? rename,
    runObsidian: overrides.runObsidian ?? runObsidian,
  };
}

async function resolveVault(vaultRoot) {
  if (typeof vaultRoot !== "string" || vaultRoot.trim().length === 0) {
    throw new Error("--vault-root is required");
  }
  if (!isAbsolute(vaultRoot)) {
    throw new Error("--vault-root must be an absolute path");
  }

  const root = await realpath(vaultRoot);
  const rootState = await lstat(root);
  if (!rootState.isDirectory()) throw new Error(`Vault root is not a directory: ${root}`);

  const obsidianDirectory = join(root, ".obsidian");
  const obsidianState = await lstat(obsidianDirectory).catch((error) => {
    if (isMissingPathError(error)) {
      throw new Error(`Vault has no .obsidian directory: ${root}`);
    }
    throw error;
  });
  if (!obsidianState.isDirectory() || obsidianState.isSymbolicLink()) {
    throw new Error(`Vault .obsidian path must be a real directory: ${obsidianDirectory}`);
  }
  return { root, obsidianDirectory };
}

async function readMarker(markerPath) {
  let source;
  try {
    const markerState = await lstat(markerPath);
    if (!markerState.isFile() || markerState.isSymbolicLink()) {
      throw new Error(`Disposable-vault marker must be a regular file: ${markerPath}`);
    }
    source = await readFile(markerPath, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) {
      const missing = new Error(
        `Disposable-vault marker is missing. Register the vault first with npm run dev:vault:register -- --vault-root <absolute-path> --confirm-disposable`,
      );
      missing.code = "ENOENT";
      throw missing;
    }
    throw error;
  }

  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`Disposable-vault marker is invalid JSON: ${markerPath}`);
  }
}

function assertMarkerMatches(marker, vaultRoot) {
  if (
    marker === null
    || typeof marker !== "object"
    || marker.schemaVersion !== MARKER_SCHEMA_VERSION
    || marker.purpose !== MARKER_PURPOSE
    || marker.pluginId !== PLUGIN_ID
    || typeof marker.vaultRoot !== "string"
    || comparablePath(marker.vaultRoot) !== comparablePath(vaultRoot)
  ) {
    throw new Error(
      "Disposable-vault marker does not match this vault. Remove the invalid marker and register the disposable vault again.",
    );
  }
}

async function describeSourceArtifacts(
  sourceRoot,
  pluginDirectory,
  artifactNames,
  dependencies,
) {
  const artifacts = [];
  for (const name of artifactNames) {
    const sourcePath = join(sourceRoot, name);
    const sourceState = await lstat(sourcePath).catch((error) => {
      if (isMissingPathError(error)) {
        throw new Error(`Development build did not produce ${name}`);
      }
      throw error;
    });
    if (!sourceState.isFile() || sourceState.isSymbolicLink()) {
      throw new Error(`Development artifact must be a regular file: ${sourcePath}`);
    }
    if (name === "manifest.json") await assertChatobbyManifest(sourcePath);
    artifacts.push({
      name,
      sourcePath,
      targetPath: join(pluginDirectory, name),
      bytes: sourceState.size,
      sourceSha256: await dependencies.hashFile(sourcePath),
      installedSha256: undefined,
    });
  }
  return artifacts;
}

async function assertChatobbyManifest(path) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(`Manifest is not valid JSON: ${path}`);
  }
  if (manifest?.id !== PLUGIN_ID) {
    throw new Error(`Manifest plugin id must be ${PLUGIN_ID}`);
  }
}

async function installArtifacts(artifacts, pluginDirectory, dependencies) {
  const pluginDirectoryExisted = await pathExists(pluginDirectory);
  await mkdir(pluginDirectory, { recursive: true });
  const transactionId = `${process.pid}-${randomUUID()}`;
  const entries = artifacts.map((artifact) => ({
    ...artifact,
    backupPath: join(pluginDirectory, `.chatobby-dev-backup-${transactionId}-${artifact.name}`),
    stagePath: join(pluginDirectory, `.chatobby-dev-stage-${transactionId}-${artifact.name}`),
    backupCreated: false,
    installed: false,
  }));

  try {
    for (const entry of entries) {
      const targetState = await lstat(entry.targetPath).catch((error) => {
        if (isMissingPathError(error)) return undefined;
        throw error;
      });
      if (targetState && (!targetState.isFile() || targetState.isSymbolicLink())) {
        throw new Error(`Installed artifact target must be a regular file: ${entry.targetPath}`);
      }
      await copyFile(entry.sourcePath, entry.stagePath);
      const stageHash = await dependencies.hashFile(entry.stagePath);
      if (stageHash !== entry.sourceSha256) {
        throw new Error(`Staged hash mismatch for ${entry.name}`);
      }
    }

    for (const entry of entries) {
      if (await pathExists(entry.targetPath)) {
        await dependencies.renameFile(entry.targetPath, entry.backupPath);
        entry.backupCreated = true;
      }
      await dependencies.renameFile(entry.stagePath, entry.targetPath);
      entry.installed = true;
    }
  } catch (error) {
    const rollbackErrors = await rollbackEntries(entries, pluginDirectory, pluginDirectoryExisted, dependencies);
    throw deploymentError(error, rollbackErrors);
  }

  let closed = false;
  return {
    async commit() {
      if (closed) return;
      closed = true;
      for (const entry of entries) {
        await rm(entry.backupPath, { force: true });
        await rm(entry.stagePath, { force: true });
      }
    },
    async rollback() {
      if (closed) return [];
      closed = true;
      return rollbackEntries(entries, pluginDirectory, pluginDirectoryExisted, dependencies);
    },
  };
}

async function rollbackEntries(entries, pluginDirectory, pluginDirectoryExisted, dependencies) {
  const errors = [];
  for (const entry of [...entries].reverse()) {
    try {
      if (entry.installed) await rm(entry.targetPath, { force: true });
      if (entry.backupCreated) await dependencies.renameFile(entry.backupPath, entry.targetPath);
      await rm(entry.stagePath, { force: true });
      await rm(entry.backupPath, { force: true });
    } catch (error) {
      errors.push(`${entry.name}: ${errorMessage(error)}`);
    }
  }
  if (!pluginDirectoryExisted) {
    try {
      await rm(pluginDirectory);
    } catch (error) {
      if (!isMissingPathError(error) && error?.code !== "ENOTEMPTY") {
        errors.push(`plugin directory: ${errorMessage(error)}`);
      }
    }
  }
  return errors;
}

async function buildDevelopmentBundle(root) {
  await runChecked(process.execPath, [join(root, "esbuild.config.mjs")], root);
}

async function readGitState(root) {
  const revisionResult = await runChecked("git", ["rev-parse", "HEAD"], root);
  const statusResult = await runChecked("git", ["status", "--porcelain"], root);
  const changedPaths = statusResult.stdout
    .split(/\r?\n/u)
    .filter((line) => line.length > 0)
    .length;
  return {
    revision: revisionResult.stdout.trim(),
    dirty: changedPaths > 0,
    changedPaths,
  };
}

async function runObsidian(command, arguments_, root) {
  return runChecked(command?.trim() || DEFAULT_OBSIDIAN_CLI, arguments_, root);
}

async function runChecked(command, arguments_, cwd) {
  const result = await runProcess(command, arguments_, cwd);
  if (result.exitCode !== 0) {
    const detail = joinProcessOutput(result);
    throw new Error(
      `${command} ${arguments_.join(" ")} failed with exit code ${result.exitCode}${detail ? `\n${detail}` : ""}`,
    );
  }
  return result;
}

function runProcess(command, arguments_, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      cwd,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolvePromise({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}

async function sha256File(path) {
  const source = await readFile(path);
  return createHash("sha256").update(source).digest("hex");
}

function parseArguments(arguments_) {
  const [action, ...tokens] = arguments_;
  if (action === undefined || action === "--help" || action === "-h") {
    return { help: true };
  }
  if (action !== "register" && action !== "deploy") {
    throw new Error(`Unknown action: ${action}`);
  }

  const options = {
    action,
    repositoryRoot,
    includeManifest: false,
    reload: true,
    confirmDisposable: false,
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--confirm-disposable") options.confirmDisposable = true;
    else if (token === "--include-manifest") options.includeManifest = true;
    else if (token === "--no-reload") options.reload = false;
    else if (token === "--vault-root") options.vaultRoot = requiredOptionValue(tokens, ++index, token);
    else if (token === "--vault-name") options.vaultName = requiredOptionValue(tokens, ++index, token);
    else if (token === "--obsidian-cli") options.obsidianCli = requiredOptionValue(tokens, ++index, token);
    else if (token === "--help" || token === "-h") return { help: true };
    else throw new Error(`Unknown option: ${token}`);
  }
  if (typeof options.vaultRoot !== "string") throw new Error("--vault-root is required");
  if (action === "register" && (options.includeManifest || !options.reload)) {
    throw new Error("--include-manifest and --no-reload apply only to deployment");
  }
  if (action === "deploy" && options.confirmDisposable) {
    throw new Error("--confirm-disposable applies only to registration");
  }
  return options;
}

function requiredOptionValue(tokens, index, option) {
  const value = tokens[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function printUsage() {
  console.log(`Chatobby disposable-vault frontend deployment

Register one dedicated disposable vault once:
  npm run dev:vault:register -- --vault-root <absolute-path> --confirm-disposable

Build, copy, verify, reload Chatobby, and report fresh developer errors:
  npm run dev:vault -- --vault-root <absolute-path>

Deployment options:
  --include-manifest       Also copy manifest.json when plugin metadata changed
  --no-reload              Copy and verify only; do not invoke the Obsidian CLI
  --vault-name <name>      Override the Obsidian CLI vault name (defaults to folder name)
  --obsidian-cli <command> Override the Obsidian CLI executable or absolute path`);
}

function printRegistration(result) {
  console.log(result.created
    ? "Registered disposable Chatobby development vault."
    : "Disposable Chatobby development vault was already registered.");
  console.log(`Vault: ${result.vaultRoot}`);
  console.log(`Marker: ${result.markerPath}`);
}

function printDeployment(result) {
  console.log("Deployed Chatobby frontend development artifacts.");
  console.log(`Vault: ${result.vaultRoot}`);
  console.log(`Plugin: ${result.pluginDirectory}`);
  console.log(
    `Source: ${result.sourceState.revision} (${result.sourceState.dirty ? `dirty, ${result.sourceState.changedPaths} changed paths` : "clean"})`,
  );
  for (const artifact of result.artifacts) {
    console.log(
      `${artifact.name}: ${artifact.bytes} bytes, sha256=${artifact.installedSha256}`,
    );
  }
  console.log(
    `Timings: build=${result.timingsMs.build}ms copy+verify=${result.timingsMs.copyAndVerify}ms reload+errors=${result.timingsMs.reloadAndErrors}ms total=${result.timingsMs.total}ms`,
  );
  console.log(result.reload ? "Reload: Chatobby reloaded." : "Reload: skipped (--no-reload).");
  console.log("Fresh Obsidian developer errors:");
  console.log(result.reload
    ? result.developerErrors || "(none reported)"
    : "(not queried because reload was skipped)");
}

function deploymentError(error, rollbackErrors, recoveryReloadError) {
  const details = [errorMessage(error)];
  if (rollbackErrors.length > 0) details.push(`Rollback errors: ${rollbackErrors.join("; ")}`);
  if (recoveryReloadError) details.push(`Recovery reload error: ${recoveryReloadError}`);
  return new Error(details.join("\n"));
}

function comparablePath(path) {
  const comparable = normalize(resolve(path));
  return process.platform === "win32" ? comparable.toLowerCase() : comparable;
}

function joinProcessOutput(result) {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingPathError(error) {
  return error?.code === "ENOENT";
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
}

async function assertSafeOptionalDirectory(path, label) {
  const state = await lstat(path).catch((error) => {
    if (isMissingPathError(error)) return undefined;
    throw error;
  });
  if (state && (!state.isDirectory() || state.isSymbolicLink())) {
    throw new Error(`${label} must be a real directory: ${path}`);
  }
}

function roundedMilliseconds(value) {
  return Math.round(value * 100) / 100;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return;
    }
    if (options.action === "register") {
      printRegistration(await registerDevVault(options));
      return;
    }
    printDeployment(await deployDevVault(options));
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
