import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("connector CI installation gates", () => {
  it("builds and receipts exact artifacts only after verification", async () => {
    const workflow = await workflowText();

    expect(workflow).toContain("build-connector-artifact:");
    expect(workflow).toContain("needs: [classify, verify]");
    expect(workflow).toContain("needs.verify.result == 'success'");
    expect(workflow).toContain("needs.classify.outputs.lane == 'documentation-version-release'");
    expect(workflow).toContain("npm run ci:connector-artifact");
    expect(workflow).toContain("ci-artifacts/connector");
    expect(workflow).toContain("Record hashes and exercise temporary-vault installation");
  });

  it("keeps live Obsidian off untrusted pull requests and resets the disposable runner", async () => {
    const workflow = await workflowText();

    expect(workflow).not.toContain("pull_request_target:");
    expect(workflow).toContain("inputs.local_acceptance_complete && inputs.installed_acceptance");
    expect(workflow).toContain("github.repository == 'TitanicEclair/chatobby'");
    expect(workflow).toContain("runs-on: [self-hosted, Windows, X64, chatobby-disposable-obsidian]");
    expect(workflow).toContain("environment: chatobby-disposable-obsidian");
    expect(workflow).toContain("-Phase Before");
    expect(workflow).toContain("-Phase After");
    expect(workflow.match(/if: always\(\)/gu)).toHaveLength(2);
    expect(workflow).toContain("downloaded-connector");
    expect(workflow).toContain("scripts/ci-obsidian-smoke.mjs");
  });

  it("reserves hosted builds for manual final checks after local acceptance", async () => {
    const workflow = await workflowText();
    expect(workflow).not.toMatch(/^ {2}(?:push|pull_request|schedule|repository_dispatch):/mu);
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toMatch(/local_acceptance_complete:[\s\S]*?default: false/u);
    for (const name of ["classify", "branch-policy", "build-connector-artifact", "live-obsidian-smoke"]) {
      const job = workflow.match(new RegExp(`^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [a-z][a-z-]*:|$(?![\\s\\S]))`, "mu"))?.[1];
      expect(job?.match(/^ {4}if: ([^\n]*(?:\n {6}[^\n]*)*)/mu)?.[1]).toContain("inputs.local_acceptance_complete");
    }
  });

  it("does not enable approval-gated automatic provisioning in the public release workflow", async () => {
    const workflow = await readFile(join(repositoryRoot, ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).not.toContain("CHATOBBY_OBSIDIAN_APPROVED_AUTOMATIC_RUNTIME_PROVISIONING");
  });
});

async function workflowText(): Promise<string> {
  return readFile(join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");
}
