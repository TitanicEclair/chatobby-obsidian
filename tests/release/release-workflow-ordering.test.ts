import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const releaseWorkflowPath = join(repositoryRoot, ".github", "workflows", "release.yml");

describe("connector release ordering", () => {
  it("publishes and verifies assets before advancing the public default branch", async () => {
    const workflow = await readFile(releaseWorkflowPath, "utf8");
    const publish = workflow.indexOf("- name: Publish GitHub release");
    const verify = workflow.indexOf("- name: Verify published release before promotion");
    const promote = workflow.indexOf("- name: Promote verified release to public main");

    expect(publish).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(publish);
    expect(promote).toBeGreaterThan(verify);
    expect(workflow.slice(0, publish)).not.toContain("git/refs/heads/main");
  });

  it("promotes only an exact fast-forward tag and confirms the remote ref", async () => {
    const workflow = await readFile(releaseWorkflowPath, "utf8");

    expect(workflow).toContain('= "main.js,manifest.json,styles.css"');
    expect(workflow).toContain('git merge-base --is-ancestor "$current_main" "$GITHUB_SHA"');
    expect(workflow).toContain('-f sha="$GITHUB_SHA"');
    expect(workflow).toContain("-F force=false");
    expect(workflow).toContain("for attempt in $(seq 1 20)");
    expect(workflow).toContain("git ls-remote origin refs/heads/main");
    expect(workflow).toContain('test "$promoted_main" = "$GITHUB_SHA"');
  });
});
