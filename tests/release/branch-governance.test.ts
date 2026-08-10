import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("connector branch governance", () => {
  it("checks dev, main, and temporary release branches", async () => {
    const workflow = await readFile(join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");

    expect(workflow).toContain("- dev");
    expect(workflow).toContain("- main");
    expect(workflow).toContain('"release/**"');
    expect(workflow).toContain('[[ "$HEAD_BRANCH" == release/* ]]');
    expect(workflow).toContain("feature/*|fix/*|docs/*|chore/*|automation/*|codex/*");
  });

  it("cannot publish releases from the private repository", async () => {
    const workflow = await readFile(join(repositoryRoot, ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("if: github.repository == 'TitanicEclair/chatobby-obsidian'");
  });
});
