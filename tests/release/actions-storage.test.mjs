import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyArtifact,
  loadActionsStoragePolicy,
  runActionsStorageCleanup,
  validateWorkflowArtifactRetentions,
} from "../../scripts/actions-storage.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const now = new Date("2026-09-04T00:00:00.000Z");

describe("connector GitHub Actions storage governance", () => {
  it("validates the projected policy and explicit upload retention", async () => {
    const policy = await loadActionsStoragePolicy();
    expect(policy).toMatchObject({
      schemaVersion: 1,
      repository: "TitanicEclair/chatobby",
      artifactDays: {
        candidateTransfer: 1,
        candidateResume: 7,
        portableEvidence: 14,
        operationalEvidence: 30,
      },
      cacheMaximumAgeDays: 30,
      cleanupMaxItems: 50,
      cleanupMaxBytes: 10_737_418_240,
    });
    expect(await validateWorkflowArtifactRetentions(repositoryRoot, policy)).toEqual([]);
    expect(JSON.parse(await readFile(join(repositoryRoot, "config", "actions-storage-policy.schema.json"), "utf8"))).toMatchObject({
      title: "Chatobby connector Actions storage policy",
      additionalProperties: false,
    });
  });

  it("classifies only reserved connector artifact names", () => {
    expect(classifyArtifact("chatobby-connector-candidate-transfer-win32-x64")).toBe("candidate-transfer");
    expect(classifyArtifact("chatobby-connector-candidate-0.5.0")).toBe("candidate-resume");
    expect(classifyArtifact("chatobby-connector-portable-ci")).toBe("portable-evidence");
    expect(classifyArtifact("chatobby-connector-staging-0.5.0")).toBe("operational-evidence");
    expect(classifyArtifact("third-party-output")).toBe("unmanaged");
  });

  it("refuses to operate outside the policy-owned private connector repository", async () => {
    await expect(
      runActionsStorageCleanup({
        repository: "TitanicEclair/chatobby-obsidian",
        token: "test-token",
        now,
        fetcher: (await createFixture()).fetcher,
      }),
    ).rejects.toThrow("Policy is scoped to TitanicEclair/chatobby");
  });

  it("dry-runs stale managed entries while retaining protected and unknown artifacts", async () => {
    const fixture = await createFixture();
    const receipt = await runActionsStorageCleanup({
      repository: "TitanicEclair/chatobby",
      token: "test-token",
      protectedRunIds: [777],
      now,
      fetcher: fixture.fetcher,
    });

    expect(receipt.mode).toBe("dry-run");
    expect(receipt.selected.map((entry) => [entry.kind, entry.id])).toEqual([
      ["cache", 10],
      ["artifact", 2],
    ]);
    expect(receipt.deleted).toEqual([]);
    expect(receipt.protectedRunIds).toEqual([777]);
    expect(receipt.workflowRunsDeleted).toBe(0);
    expect(receipt.releasesDeleted).toBe(0);
    expect(receipt.tagsDeleted).toBe(0);
  });

  it("deletes only current eligible exact IDs and rejects unsafe execution", async () => {
    const fixture = await createFixture();
    const receipt = await runActionsStorageCleanup({
      repository: "TitanicEclair/chatobby",
      token: "test-token",
      execute: true,
      artifactIds: [2],
      cacheIds: [10],
      protectedRunIds: [777],
      now,
      fetcher: fixture.fetcher,
    });

    expect(receipt.deleted.map((entry) => [entry.kind, entry.id])).toEqual([
      ["artifact", 2],
      ["cache", 10],
    ]);
    expect(receipt.before.bytes - receipt.after.bytes).toBe(500);
    expect(fixture.deletedUrls).toEqual([
      "https://api.github.com/repos/TitanicEclair/chatobby/actions/artifacts/2",
      "https://api.github.com/repos/TitanicEclair/chatobby/actions/caches/10",
    ]);

    await expect(
      runActionsStorageCleanup({
        repository: "TitanicEclair/chatobby",
        token: "test-token",
        execute: true,
        protectedRunIds: [777],
        now,
        fetcher: (await createFixture()).fetcher,
      }),
    ).rejects.toThrow("requires one or more exact");
    await expect(
      runActionsStorageCleanup({
        repository: "TitanicEclair/chatobby",
        token: "test-token",
        execute: true,
        artifactIds: [1],
        protectedRunIds: [777],
        now,
        fetcher: (await createFixture()).fetcher,
      }),
    ).rejects.toThrow("protected by explicit owner input");
  });
});

async function createFixture() {
  const artifacts = [
    artifact(1, "chatobby-connector-candidate-0.5.0", 100, 777, "2026-08-01T00:00:00Z"),
    artifact(2, "chatobby-connector-candidate-transfer-linux-x64", 200, 778, "2026-08-01T00:00:00Z"),
    artifact(3, "third-party-unmanaged", 400, 779, "2026-01-01T00:00:00Z"),
  ];
  const caches = [cache(10, "npm-old", 300, "2026-07-01T00:00:00Z")];
  const deletedUrls = [];
  const fetcher = async (input, init) => {
    const url = String(input);
    if (init?.method === "DELETE") {
      deletedUrls.push(url);
      const artifactMatch = url.match(/\/artifacts\/(\d+)$/u);
      const cacheMatch = url.match(/\/caches\/(\d+)$/u);
      if (artifactMatch) artifacts.splice(artifacts.findIndex((item) => item.id === Number(artifactMatch[1])), 1);
      if (cacheMatch) caches.splice(caches.findIndex((item) => item.id === Number(cacheMatch[1])), 1);
      return new Response(null, { status: 204 });
    }
    if (url.includes("/actions/artifacts?")) return Response.json({ total_count: artifacts.length, artifacts });
    if (url.includes("/actions/caches?")) return Response.json({ total_count: caches.length, actions_caches: caches });
    return new Response(null, { status: 404 });
  };
  return { fetcher, deletedUrls };
}

function artifact(id, name, size, runId, createdAt) {
  return {
    id,
    name,
    size_in_bytes: size,
    created_at: createdAt,
    updated_at: createdAt,
    expired: false,
    expires_at: "2026-12-01T00:00:00Z",
    workflow_run: { id: runId, head_sha: "1".repeat(40) },
  };
}

function cache(id, key, size, lastAccessedAt) {
  return {
    id,
    ref: "refs/heads/dev",
    key,
    version: "v1",
    last_accessed_at: lastAccessedAt,
    created_at: lastAccessedAt,
    size_in_bytes: size,
  };
}
