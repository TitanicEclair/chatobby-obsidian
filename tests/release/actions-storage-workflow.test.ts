import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(import.meta.dirname, "../../.github/workflows/actions-storage.yml");

describe("connector Actions storage workflow", () => {
  it("keeps scheduled cleanup read-only and gates exact-ID deletion behind owner approval", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const script = await readFile(resolve(import.meta.dirname, "../../scripts/actions-storage.mjs"), "utf8");
    const dryRun = workflow.slice(workflow.indexOf("  dry-run:"), workflow.lastIndexOf("  execute:"));
    const execute = workflow.slice(workflow.lastIndexOf("  execute:"));

    expect(workflow).toContain('cron: "53 3 * * 1"');
    expect(dryRun).toContain("github.event_name == 'schedule' || inputs.execute != true");
    expect(dryRun).toContain("actions: read");
    expect(dryRun).not.toContain("--execute");
    expect(execute).toContain("environment: chatobby-actions-storage-cleanup");
    expect(execute).toContain("actions: write");
    expect(execute).toContain("--execute");
    expect(execute).toContain('args+=(--artifact-id "${id}")');
    expect(execute).toContain('args+=(--cache-id "${id}")');
    expect(execute).toContain('args+=(--protect-run-id "${id}")');
    expect(workflow).not.toContain("actions/upload-artifact");
    expect(workflow).not.toContain("actions/runs/");
    expect(workflow).not.toContain("/releases/");
    expect(workflow).not.toContain("/git/refs/");
    expect(script).not.toContain("/actions/runs/");
    expect(script).not.toContain("/releases/");
    expect(script).not.toContain("/git/refs/");
  });
});
