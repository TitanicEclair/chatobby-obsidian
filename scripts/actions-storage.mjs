import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = join(repositoryRoot, "config", "actions-storage-policy.json");

export async function loadActionsStoragePolicy(path = policyPath) {
  return parseActionsStoragePolicy(JSON.parse(await readFile(path, "utf8")));
}

export function parseActionsStoragePolicy(value) {
  const policy = strictRecord(
    value,
    [
      "$schema",
      "schemaVersion",
      "owner",
      "repository",
      "sourceAuthority",
      "transientArtifactDays",
      "retainedArtifacts",
      "retainedCaches",
      "cleanupMaxItems",
      "cleanupMaxBytes",
    ],
    "Actions storage policy",
  );
  if (policy.$schema !== "./actions-storage-policy.schema.json") {
    throw new Error("Actions storage policy must reference its repository schema");
  }
  if (policy.schemaVersion !== 2) throw new Error("Actions storage policy schemaVersion must equal 2");
  const repository = requiredRepository(policy.repository);
  const owner = requiredString(policy.owner, "policy owner");
  const sourceAuthority = requiredString(policy.sourceAuthority, "source authority");
  if (repository !== "TitanicEclair/chatobby") {
    throw new Error("Actions storage policy must remain scoped to the private connector repository");
  }
  if (sourceAuthority !== "TitanicEclair/pi-mono:config/chatobby.operations.json#retention.actionsStorage") {
    throw new Error("Actions storage policy must identify the canonical source operations authority");
  }
  if (policy.transientArtifactDays !== 1 || policy.retainedArtifacts !== 0 || policy.retainedCaches !== 0)
    throw new Error("Actions requires zero durable retention and one-day transfer fallback");
  const parsed = {
    schemaVersion: 2,
    owner,
    repository,
    sourceAuthority,
    transientArtifactDays: 1,
    retainedArtifacts: 0,
    retainedCaches: 0,
    cleanupMaxItems: positiveInteger(policy.cleanupMaxItems, "cleanup maximum items"),
    cleanupMaxBytes: positiveInteger(policy.cleanupMaxBytes, "cleanup maximum bytes"),
  };
  if (parsed.cleanupMaxItems !== 50 || parsed.cleanupMaxBytes !== 10737418240)
    throw new Error("Connector cleanup bounds must match canonical operations policy");
  return parsed;
}

export async function validateWorkflowArtifactRetentions(root = repositoryRoot, policy) {
  const validatedPolicy = policy ?? (await loadActionsStoragePolicy());
  const allowedDays = new Set([validatedPolicy.transientArtifactDays]);
  const workflowRoot = join(root, ".github", "workflows");
  const workflows = (await readdir(workflowRoot)).filter((name) => /\.ya?ml$/u.test(name));
  const issues = [];
  for (const name of workflows) {
    const lines = (await readFile(join(workflowRoot, name), "utf8")).split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      if (!/uses:\s*actions\/upload-artifact@/u.test(lines[index])) continue;
      const indentation = leadingWhitespace(lines[index]);
      let retentionDays = null;
      for (let following = index + 1; following < lines.length; following += 1) {
        const line = lines[following];
        if (line.trim() && leadingWhitespace(line) <= indentation && /^\s*-/u.test(line)) break;
        const match = line.match(/^\s*retention-days:\s*([0-9]+)\s*$/u);
        if (match) retentionDays = Number(match[1]);
      }
      if (retentionDays === null) {
        issues.push(`${name}:${index + 1}: upload-artifact requires explicit retention-days`);
      } else if (!allowedDays.has(retentionDays)) {
        issues.push(`${name}:${index + 1}: retention-days ${retentionDays} is not a governed class`);
      }
    }
  }
  return issues;
}

export async function runActionsStorageCleanup(options) {
  const policy = options.policy ?? (await loadActionsStoragePolicy());
  const repository = requiredRepository(options.repository);
  if (repository !== policy.repository) {
    throw new Error(`Policy is scoped to ${policy.repository}, not ${repository}`);
  }
  const token = requiredString(options.token, "GitHub token");
  const protectedRunIds = [];
  const startedAt = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;
  const before = await inventoryActionsStorage({ repository, token, policy, protectedRunIds, now: startedAt, fetcher });
  const artifactIds = uniqueIds(options.artifactIds ?? [], "artifact ID");
  if (options.consumedRunId !== undefined) {
    positiveInteger(options.consumedRunId, "consumed run ID");
    for (const entry of before.entries)
      if (entry.kind === "artifact" && entry.workflowRunId === options.consumedRunId) {
        entry.eligible = true;
        entry.protectedReason = null;
        if (!artifactIds.includes(entry.id)) artifactIds.push(entry.id);
      }
  }
  const cacheIds = uniqueIds(options.cacheIds ?? [], "cache ID");
  const hasExactIds = artifactIds.length + cacheIds.length > 0;
  if (options.execute && !hasExactIds && !options.automatic && !options.consumedRunId) {
    throw new Error("Execute mode requires one or more exact --artifact-id or --cache-id values");
  }
  let selected = selectEntries(before.entries, artifactIds, cacheIds, hasExactIds);
  if (options.consumedRunId)
    selected = selected.filter((e) => e.kind === "artifact" && e.workflowRunId === options.consumedRunId);
  if (options.automatic) {
    let bytes = 0;
    selected = selected.filter((e, i) => {
      if (e.sizeBytes > policy.cleanupMaxBytes) throw new Error(`Artifact ${e.id} exceeds cleanup bound`);
      if (i >= policy.cleanupMaxItems || bytes + e.sizeBytes > policy.cleanupMaxBytes) return false;
      bytes += e.sizeBytes;
      return true;
    });
  }
  const selectedBytes = selected.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  if (selected.length > policy.cleanupMaxItems) {
    throw new Error(`Cleanup selection exceeds ${policy.cleanupMaxItems} items`);
  }
  if (selectedBytes > policy.cleanupMaxBytes) {
    throw new Error(`Cleanup selection exceeds ${policy.cleanupMaxBytes} bytes`);
  }

  const deleted = [];
  if (options.execute) {
    for (const entry of selected) {
      if (
        entry.kind === "artifact" &&
        entry.workflowRunId !== null &&
        entry.workflowRunId !== options.consumedRunId &&
        !(await runHasCompleted(fetcher, repository, token, entry.workflowRunId))
      )
        throw new Error(`Producer ${entry.workflowRunId} became active`);
      await deleteEntry(repository, token, entry, fetcher);
      deleted.push(storageIdentity(entry));
      if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(
          process.env.GITHUB_STEP_SUMMARY,
          `${JSON.stringify({ repository, action: "deleted", ...storageIdentity(entry) })}\n`,
        );
      if (options.receiptPath) {
        const progressPath = resolve(options.receiptPath);
        await mkdir(dirname(progressPath), { recursive: true });
        await writeFile(
          progressPath,
          `${JSON.stringify(
            {
              schemaVersion: 1,
              status: "in-progress",
              repository,
              startedAt: startedAt.toISOString(),
              before: before.totals,
              deleted,
              after: null,
            },
            null,
            2,
          )}\n`,
        );
      }
    }
  }
  const finishedAt = new Date();
  const after = options.execute
    ? await inventoryActionsStorage({ repository, token, policy, protectedRunIds, now: finishedAt, fetcher })
    : before;
  const receipt = {
    schemaVersion: 1,
    mode: options.execute ? "execute" : "dry-run",
    repository,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    before: before.totals,
    selected: selected.map(storageIdentity),
    deleted,
    after: after.totals,
    protectedRunIds: before.protectedRunIds,
    workflowRunsDeleted: 0,
    releasesDeleted: 0,
    tagsDeleted: 0,
  };
  if (options.receiptPath) {
    const receiptPath = resolve(options.receiptPath);
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  }
  return receipt;
}

export async function inventoryActionsStorage(options) {
  const artifacts = await listAll(options.fetcher, options.repository, options.token, "artifacts");
  const caches = await listAll(options.fetcher, options.repository, options.token, "caches");
  const protectedIds = new Set();
  const statuses = new Map();
  for (const a of artifacts) {
    const id = a.workflow_run?.id;
    if (!id) continue;
    if (!statuses.has(id))
      statuses.set(id, await runHasCompleted(options.fetcher, options.repository, options.token, id));
    if (!statuses.get(id)) protectedIds.add(id);
  }
  const entries = [
    ...artifacts.map((value) => parseArtifact(value, options.policy, protectedIds, options.now)),
    ...caches.map((value) => parseCache(value, options.policy, options.now)),
  ].sort(
    (left, right) => right.sizeBytes - left.sizeBytes || left.kind.localeCompare(right.kind) || left.id - right.id,
  );
  const eligible = entries.filter((entry) => entry.eligible);
  return {
    schemaVersion: 1,
    repository: options.repository,
    capturedAt: options.now.toISOString(),
    protectedRunIds: [...protectedIds].sort((left, right) => left - right),
    totals: {
      artifacts: artifacts.length,
      caches: caches.length,
      bytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
      eligibleItems: eligible.length,
      eligibleBytes: eligible.reduce((sum, entry) => sum + entry.sizeBytes, 0),
    },
    entries,
  };
}

async function listAll(fetcher, repository, token, type) {
  const values = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetcher(
      `https://api.github.com/repos/${repository}/actions/${type}?per_page=${PAGE_SIZE}&page=${page}`,
      { headers: githubHeaders(token) },
    );
    if (!response.ok) throw new Error(`GitHub Actions ${type} inventory failed with HTTP ${response.status}`);
    const key = type === "artifacts" ? "artifacts" : "actions_caches";
    const body = looseRecord(await response.json(), `GitHub Actions ${type} response`);
    if (!Array.isArray(body[key])) throw new Error(`GitHub Actions ${type} response is invalid`);
    values.push(...body[key]);
    if (body[key].length < PAGE_SIZE) return values;
  }
  throw new Error(`GitHub Actions ${type} inventory exceeded ${MAX_PAGES} pages`);
}

function parseArtifact(value, policy, protectedRunIds, now) {
  const artifact = looseRecord(value, "artifact");
  const workflowRun =
    artifact.workflow_run === null ? null : looseRecord(artifact.workflow_run, "artifact workflow run");
  const workflowRunId = workflowRun ? positiveInteger(workflowRun.id, "artifact workflow run ID") : null;
  const createdAt = timestamp(artifact.created_at, "artifact created_at");
  const name = requiredString(artifact.name, "artifact name");
  const storageClass = classifyArtifact(name);
  const retentionDays = policy.transientArtifactDays;
  const protectedReason =
    workflowRunId !== null && protectedRunIds.has(workflowRunId)
      ? `workflow run ${workflowRunId} is still active`
      : null;
  const ageDays = elapsedDays(createdAt, now);
  return {
    kind: "artifact",
    id: positiveInteger(artifact.id, "artifact ID"),
    name,
    sizeBytes: nonNegativeInteger(artifact.size_in_bytes, "artifact size"),
    createdAt: createdAt.toISOString(),
    lastUsedAt: timestamp(artifact.updated_at ?? artifact.created_at, "artifact updated_at").toISOString(),
    workflowRunId,
    storageClass,
    retentionDays,
    ageDays,
    protectedReason,
    eligible: protectedReason === null,
  };
}

function parseCache(value, policy, now) {
  const cache = looseRecord(value, "cache");
  const createdAt = timestamp(cache.created_at, "cache created_at");
  const lastUsedAt = timestamp(cache.last_accessed_at, "cache last_accessed_at");
  const ageDays = elapsedDays(lastUsedAt, now);
  return {
    kind: "cache",
    id: positiveInteger(cache.id, "cache ID"),
    name: requiredString(cache.key, "cache key"),
    sizeBytes: nonNegativeInteger(cache.size_in_bytes, "cache size"),
    createdAt: createdAt.toISOString(),
    lastUsedAt: lastUsedAt.toISOString(),
    workflowRunId: null,
    storageClass: "cache",
    retentionDays: policy.retainedCaches,
    ageDays,
    protectedReason: null,
    eligible: ageDays >= policy.retainedCaches,
  };
}

export function classifyArtifact(name) {
  if (/^chatobby-connector-(?:candidate-transfer|release-shard)-/u.test(name)) return "candidate-transfer";
  if (/^chatobby-connector-(?:candidate|candidate-resume|aggregate)-/u.test(name)) return "candidate-resume";
  if (/^chatobby-connector-(?:portable|ci)-/u.test(name)) return "portable-evidence";
  if (/^chatobby-connector-(?:monitor|staging)-/u.test(name)) return "operational-evidence";
  return "unmanaged";
}

async function runHasCompleted(fetcher, repository, token, id) {
  const r = await fetcher(`https://api.github.com/repos/${repository}/actions/runs/${id}`, {
    headers: githubHeaders(token),
  });
  if (r.status === 404) return true;
  if (!r.ok) throw new Error(`Workflow ${id} status failed: ${r.status}`);
  return (await r.json()).status === "completed";
}

function selectEntries(entries, artifactIds, cacheIds, hasExactIds) {
  if (!hasExactIds) return entries.filter((entry) => entry.eligible);
  const selected = [];
  for (const [kind, ids] of [
    ["artifact", artifactIds],
    ["cache", cacheIds],
  ]) {
    for (const id of ids) {
      const entry = entries.find((candidate) => candidate.kind === kind && candidate.id === id);
      if (!entry) throw new Error(`Requested ${kind} ID ${id} is not present in the current inventory`);
      if (!entry.eligible) {
        throw new Error(
          `Requested ${kind} ID ${id} is not eligible${entry.protectedReason ? `: ${entry.protectedReason}` : ""}`,
        );
      }
      selected.push(entry);
    }
  }
  return selected;
}

async function deleteEntry(repository, token, entry, fetcher) {
  const collection = entry.kind === "artifact" ? "artifacts" : "caches";
  const response = await fetcher(`https://api.github.com/repos/${repository}/actions/${collection}/${entry.id}`, {
    method: "DELETE",
    headers: githubHeaders(token),
  });
  if (response.status !== 204 && response.status !== 404) {
    throw new Error(`GitHub Actions ${entry.kind} ${entry.id} deletion failed with HTTP ${response.status}`);
  }
}

function storageIdentity(entry) {
  return { kind: entry.kind, id: entry.id, name: entry.name, sizeBytes: entry.sizeBytes };
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function strictRecord(value, keys, label) {
  const record = looseRecord(value, label);
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${label} must contain exactly: ${[...keys].sort().join(", ")}`);
  }
  return record;
}

function looseRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requiredRepository(value) {
  const repository = requiredString(value, "repository");
  if (!REPOSITORY_PATTERN.test(repository)) throw new Error("repository must be an owner/name pair");
  return repository;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

function uniqueIds(values, label) {
  const parsed = values.map((value) => positiveInteger(value, label));
  if (new Set(parsed).size !== parsed.length) throw new Error(`${label}s must not contain duplicates`);
  return parsed;
}

function timestamp(value, label) {
  const date = new Date(requiredString(value, label));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be an ISO timestamp`);
  return date;
}

function elapsedDays(then, now) {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / DAY_MILLISECONDS));
}

function leadingWhitespace(value) {
  return value.length - value.trimStart().length;
}

function cliArguments(arguments_) {
  const options = { artifactIds: [], cacheIds: [], automatic: false, execute: false, checkPolicy: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const next = () => {
      index += 1;
      if (index >= arguments_.length) throw new Error(`${argument} requires a value`);
      return arguments_[index];
    };
    switch (argument) {
      case "--check-policy":
        options.checkPolicy = true;
        break;
      case "--repository":
        options.repository = next();
        break;
      case "--artifact-id":
        options.artifactIds.push(Number(next()));
        break;
      case "--cache-id":
        options.cacheIds.push(Number(next()));
        break;
      case "--consumed-run-id":
        options.consumedRunId = Number(next());
        break;
      case "--completed":
        options.automatic = true;
        break;
      case "--assert-zero":
        options.assertZero = true;
        break;
      case "--receipt":
        options.receiptPath = next();
        break;
      case "--execute":
        options.execute = true;
        break;
      default:
        throw new Error(`Unknown argument ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = cliArguments(process.argv.slice(2));
  const policy = await loadActionsStoragePolicy();
  if (options.checkPolicy) {
    const issues = await validateWorkflowArtifactRetentions(repositoryRoot, policy);
    if (issues.length > 0) throw new Error(issues.join("\n"));
    process.stdout.write(`Validated Actions storage policy ${policy.schemaVersion} for ${policy.repository}.\n`);
    return;
  }
  const receipt = await runActionsStorageCleanup({
    policy,
    repository: options.repository,
    token: process.env.GITHUB_TOKEN,
    execute: options.execute,
    artifactIds: options.artifactIds,
    cacheIds: options.cacheIds,
    automatic: options.automatic,
    consumedRunId: options.consumedRunId,
    receiptPath: options.receiptPath,
  });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, JSON.stringify(receipt) + "\n");
  if (options.assertZero && receipt.after.eligibleItems !== 0)
    throw new Error("Completed storage remains; retry bounded cleanup");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
