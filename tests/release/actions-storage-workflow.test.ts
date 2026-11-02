import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { exportReviewableSource } from "../../scripts/export-reviewable-source.mjs";
const root = resolve(import.meta.dirname, "../..");
const workflowPath = ".github/workflows/actions-storage.yml";

async function verifyWorkflowBoundary(repositoryRoot: string): Promise<"private" | "exported"> {
  const boundary = JSON.parse(await readFile(resolve(repositoryRoot, "boundary-manifest.json"), "utf8"));
  expect(boundary.reviewableExportFiles).not.toContain(workflowPath);
  expect(boundary.excludedExportPaths).toContain(workflowPath);
  const workflow = await readFile(resolve(repositoryRoot, workflowPath), "utf8").catch((error: unknown) => {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    return undefined;
  });
  // The committed export boundary deliberately omits private housekeeping.
  // Keep this test executable in that reviewable/public source tree.
  if (workflow === undefined) return "exported";
  expect(workflow).toContain('cron: "53 3 * * *"');
  expect(workflow).toContain("types: [completed]");
  expect(workflow).toContain("github.repository == 'TitanicEclair/chatobby'");
  expect(workflow).toContain("--execute --completed --assert-zero");
  for (const word of ["npm ci", "cache: npm", "upload-artifact", "environment:"])
    expect(workflow).not.toContain(word);
  return "private";
}

describe("connector storage workflow", () => {
  it("cleans completed work daily and cannot enter the public projection", async () => {
    await verifyWorkflowBoundary(root);
  });
  it("checks the intentionally absent private workflow in an actual reviewable export", async () => {
    const destination = await mkdtemp(resolve(tmpdir(), "chatobby-storage-export-"));
    try {
      await exportReviewableSource({ repositoryRoot: root, destination });
      await expect(verifyWorkflowBoundary(destination)).resolves.toBe("exported");
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  });
});
