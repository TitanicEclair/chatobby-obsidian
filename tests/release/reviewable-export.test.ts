import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportReviewableSource } from "../../scripts/export-reviewable-source.mjs";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("reviewable connector export", () => {
  it("includes the build and release configuration required by the exported package", async () => {
    const repositoryRoot = resolve(import.meta.dirname, "../..");
    const destination = await temporaryDirectory("chatobby-export-build-");
    await exportReviewableSource({ repositoryRoot, destination });
    for (const file of ["eslint.config.mts", "config/actions-storage-policy.json", "config/actions-storage-policy.schema.json", "config/public-documentation-projection.json", ".github/workflows/release.yml"]) {
      const expected = git(repositoryRoot, ["show", `HEAD:${file}`]);
      await expect(readFile(join(destination, file), "utf8")).resolves.toBe(expected);
    }
  });

  // These synthetic Git repositories exercise the publication boundary, not real local secrets.
  // See docs/release-boundary.md#reviewable-connector for the committed-byte contract.
  it("exports committed bytes only and binds the exact deterministic file inventory", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-committed-");
    await writeFixture(repositoryRoot, true);
    const committed = git(repositoryRoot, ["rev-parse", "HEAD"]).trim();
    await writeFile(join(repositoryRoot, "src/main.ts"), "UNCOMMITTED_PRIVATE_SENTINEL\n");
    git(repositoryRoot, ["add", "--", "src/main.ts"]);
    await writeFile(join(repositoryRoot, "src/private-note.txt"), "UNTRACKED_PRIVATE_SENTINEL\n");
    await writeFile(join(repositoryRoot, "RELEASE_NOTES_9.9.9.md"), "UNTRACKED_RELEASE_SENTINEL\n");
    await writeFile(join(repositoryRoot, "boundary-manifest.json"), "not the committed policy");
    const first = await temporaryDirectory("chatobby-export-first-");
    const second = await temporaryDirectory("chatobby-export-second-");
    await exportReviewableSource({ repositoryRoot, destination: first });
    await exportReviewableSource({ repositoryRoot, destination: second });
    const inventoryBytes = await readFile(join(first, "reviewable-export-inventory.json"), "utf8");
    expect(await readFile(join(second, "reviewable-export-inventory.json"), "utf8")).toBe(inventoryBytes);
    const inventory = JSON.parse(inventoryBytes) as {
      sourceRevision: string;
      files: Array<{ path: string; gitBlob: string; bytes: number; sha256: string }>;
    };
    expect(inventory.sourceRevision).toBe(committed);
    const exported = inventory.files.map((file) => file.path);
    expect(exported).toEqual([...exported].sort());
    expect(exported).toEqual([
      "LICENSE.md", "README.md", "RELEASE_NOTES_0.3.2.md", "boundary-manifest.json", "src/main.ts", "tests/.gitkeep",
    ]);
    for (const file of inventory.files) {
      const copied = await readFile(join(first, file.path));
      expect(file.bytes).toBe(copied.length);
      expect(file.sha256).toBe(createHash("sha256").update(copied).digest("hex"));
      expect(file.gitBlob).toBe(git(repositoryRoot, ["rev-parse", `${committed}:${file.path}`]).trim());
      expect(copied.equals(execFileSync("git", ["cat-file", "blob", file.gitBlob], { cwd: repositoryRoot }))).toBe(true);
    }
    await expect(readFile(join(first, "src/private-note.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(first, "RELEASE_NOTES_9.9.9.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("excludes nested local state and maps while retaining source styles and release tests", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-recursive-");
    await writeFixture(repositoryRoot, true);
    const forbidden = [
      "src/nested/data.json", "src/nested/uppercase/DATA.JSON", "src/nested/node_modules/private.js",
      "src/nested/.obsidian/private.json", "src/nested/.codex/config.toml",
      "src/nested/.chatobby/auth.json", "src/nested/.chatobby-mcp-replies/reply.json",
      "src/nested/.env", "src/nested/.env.local", "src/nested/code.js.map", "src/nested/code.CSS.MAP",
    ];
    const permitted = ["src/ui/styles.css", "tests/release/example.test.ts", "src/vendor/public-contract.ts"];
    for (const path of [...forbidden, ...permitted]) await fixtureFile(repositoryRoot, path, `synthetic ${path}\n`);
    commitFiles(repositoryRoot, [...forbidden, ...permitted]);
    const destination = await temporaryDirectory("chatobby-export-recursive-output-");
    await exportReviewableSource({ repositoryRoot, destination });
    for (const path of forbidden) await expect(readFile(join(destination, path))).rejects.toMatchObject({ code: "ENOENT" });
    for (const path of permitted) expect(await readFile(join(destination, path), "utf8")).toBe(`synthetic ${path}\n`);
    const inventory = await readFile(join(destination, "reviewable-export-inventory.json"), "utf8");
    for (const path of forbidden) expect(inventory).not.toContain(path);
    expect(JSON.parse(inventory).excludedCounts).toEqual({
      "environment file": 2, "excluded recursive name": 7, "source map": 2,
    });
  });

  it.each([
    "//# sourceMappingURL=data:application/json;base64,SENTINEL",
    "/*# sourceMappingURL=private.css.map */",
    "run(); //# sourceMappingURL=private.js.map",
  ])(
    "refuses a committed inline or linked map directive before writing: %s", async (directive) => {
      const repositoryRoot = await temporaryDirectory("chatobby-export-map-");
      await writeFixture(repositoryRoot, true);
      await fixtureFile(repositoryRoot, "src/generated.js", `const permitted = true;\n${directive}\n`);
      commitFiles(repositoryRoot, ["src/generated.js"]);
      const destination = await temporaryDirectory("chatobby-export-map-output-");
      await expect(exportReviewableSource({ repositoryRoot, destination })).rejects.toThrow("source map directive");
      expect(await readdir(destination)).toEqual([]);
    },
  );

  it("retains source that discusses map directives inside strings and regular expressions", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-map-text-");
    await writeFixture(repositoryRoot, true);
    const source = 'export const fixture = "//# sourceMappingURL=synthetic";\nexport const pattern = /sourceMappingURL/;\n';
    await fixtureFile(repositoryRoot, "src/map-fixture.ts", source);
    commitFiles(repositoryRoot, ["src/map-fixture.ts"]);
    const destination = await temporaryDirectory("chatobby-export-map-text-output-");
    await exportReviewableSource({ repositoryRoot, destination });
    expect(await readFile(join(destination, "src/map-fixture.ts"), "utf8")).toBe(source);
  });

  it.each([false, true])("distinguishes a CSS string from a real map comment (comment=%s)", async (comment) => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-css-");
    await writeFixture(repositoryRoot, true);
    const source = comment ? "a { color: red; } /*# sourceMappingURL=private.css.map */" :
      String.raw`a::before { content: "escaped \" /*# sourceMappingURL=example */"; }`;
    await fixtureFile(repositoryRoot, "src/style.css", source);
    commitFiles(repositoryRoot, ["src/style.css"]);
    const destination = await temporaryDirectory("chatobby-export-css-output-");
    if (comment) {
      await expect(exportReviewableSource({ repositoryRoot, destination })).rejects.toThrow("source map directive");
      expect(await readdir(destination)).toEqual([]);
    } else {
      await exportReviewableSource({ repositoryRoot, destination });
      expect(await readFile(join(destination, "src/style.css"), "utf8")).toBe(source);
    }
  });

  it("rejects a committed nested symlink without resolving its target", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-link-");
    await writeFixture(repositoryRoot, true);
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: repositoryRoot, input: "../../PRIVATE_TARGET_NEVER_READ", encoding: "utf8",
    }).trim();
    git(repositoryRoot, ["update-index", "--add", "--cacheinfo", `120000,${blob},src/nested/link`]);
    commitFiles(repositoryRoot, []);
    const destination = await temporaryDirectory("chatobby-export-link-output-");
    await expect(exportReviewableSource({ repositoryRoot, destination })).rejects.toThrow("unsupported Git mode 120000");
    expect(await readdir(destination)).toEqual([]);
  });

  it("does not treat an untracked publication notice as committed", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-notice-");
    await writeFixture(repositoryRoot);
    await fixtureFile(repositoryRoot, "LICENSE.md", "uncommitted notice\n");
    const destination = await temporaryDirectory("chatobby-export-notice-output-");
    await expect(exportReviewableSource({ repositoryRoot, destination })).rejects.toThrow("missing publication files: LICENSE.md");
    expect(await readdir(destination)).toEqual([]);
  });

  it("refuses an existing nonempty destination without deleting its bytes", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-preservation-");
    await writeFixture(repositoryRoot, true);
    const destination = await temporaryDirectory("chatobby-export-preservation-output-");
    await writeFile(join(destination, "keep.txt"), "KEEP_EXISTING_BYTES");
    await expect(exportReviewableSource({ repositoryRoot, destination })).rejects.toThrow("empty");
    expect(await readFile(join(destination, "keep.txt"), "utf8")).toBe("KEEP_EXISTING_BYTES");
  });

  it.each([
    ["schemaVersion", 999, "Unsupported reviewable export schemaVersion"],
    ["reviewableExportRoots", ["../outside"], "Invalid reviewable export path"],
    ["recursiveExcludedExportNames", ["src/data.json"], "must be basenames"],
    ["recursiveExcludedExportNames", [".git", "node_modules"], "Missing recursive export exclusion: data.json"],
    ["reviewableExportFiles", ["README.md", "readme.md"], "Duplicate reviewableExportFiles"],
  ])("rejects invalid committed %s before copying", async (field, value, message) => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-policy-");
    await writeFixture(repositoryRoot, true);
    const policy = JSON.parse(await readFile(join(repositoryRoot, "boundary-manifest.json"), "utf8")) as Record<string, unknown>;
    policy[field as string] = value;
    await writeFile(join(repositoryRoot, "boundary-manifest.json"), JSON.stringify(policy));
    commitFiles(repositoryRoot, ["boundary-manifest.json"]);
    const destination = await temporaryDirectory("chatobby-export-policy-output-");
    await expect(exportReviewableSource({ repositoryRoot, destination })).rejects.toThrow(message as string);
    expect(await readdir(destination)).toEqual([]);
  });

  it("rejects relative and repository-overlapping destinations before writing", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-overlap-");
    await writeFixture(repositoryRoot, true);
    for (const destination of [repositoryRoot, join(repositoryRoot, "output"), dirname(repositoryRoot)]) {
      await expect(exportReviewableSource({ repositoryRoot, destination })).rejects.toThrow("overlap");
    }
    await expect(exportReviewableSource({ repositoryRoot, destination: "relative-output" })).rejects.toThrow("absolute");
    expect(git(repositoryRoot, ["status", "--porcelain"])).toBe("");
  });

  it("exports the current documentation link closure into a fresh publication tree", async () => {
    const destination = await temporaryDirectory("chatobby-export-current-");
    await exportReviewableSource({ repositoryRoot: resolve(import.meta.dirname, "../.."), destination });
    const missing: string[] = [];
    async function inspect(directory: string): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) { await inspect(file); continue; }
        if (!entry.name.endsWith(".md")) continue;
        for (const match of (await readFile(file, "utf8")).matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
          const raw = match[1]!.trim();
          const target = (raw.startsWith("<") ? raw.slice(1, raw.indexOf(">")) : raw.split(/\s+["']/u)[0]!).split(/[?#]/u)[0]!;
          if (!target || target.startsWith("/") || /^[a-z][a-z\d+.-]*:/iu.test(target)) continue;
          try { await access(resolve(dirname(file), decodeURIComponent(target))); }
          catch { missing.push(`${relative(destination, file)} -> ${target}`); }
        }
      }
    }
    await inspect(destination);
    expect(missing).toEqual([]);
  });
  it("fails strict export on publication gaps and records them in a draft", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-source-");
    const destination = await temporaryDirectory("chatobby-export-output-");
    await writeFixture(repositoryRoot);

    await expect(exportReviewableSource({ repositoryRoot, destination, draft: false })).rejects.toThrow(
      "missing publication files: LICENSE.md",
    );
    await expect(exportReviewableSource({ repositoryRoot, destination, draft: true })).resolves.toMatchObject({
      destination,
      publicationGaps: ["LICENSE.md"],
    });
    await expect(readFile(join(destination, "src", "main.ts"), "utf8")).resolves.toBe("export const value = 1;\n");
    await expect(readFile(join(destination, "RELEASE_NOTES_0.3.2.md"), "utf8")).resolves.toBe("# Release 0.3.2\n");
    await expect(readFile(join(destination, "RELEASE_NOTES_latest.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(destination, "publication-gaps.json"), "utf8")).resolves.toContain("LICENSE.md");
  });
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function commitFiles(root: string, paths: string[]): void {
  if (paths.length) git(root, ["add", "--", ...paths]);
  git(root, ["-c", "user.name=Export Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", "Synthetic export fixture"]);
}

async function fixtureFile(root: string, path: string, value: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), value);
}

async function writeFixture(root: string, complete = false): Promise<void> {
  git(root, ["init", "-q"]);
  git(root, ["config", "core.autocrlf", "false"]);
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "README.md"), "# Connector\n");
  await writeFile(join(root, "RELEASE_NOTES_0.3.2.md"), "# Release 0.3.2\n");
  await writeFile(join(root, "RELEASE_NOTES_latest.md"), "# Not a versioned release\n");
  await writeFile(join(root, "src", "main.ts"), "export const value = 1;\n");
  await writeFile(
    join(root, "boundary-manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      reviewableExportFiles: ["README.md", "boundary-manifest.json"],
      reviewableExportRoots: ["src", "tests"],
      requiredPublicationFiles: ["LICENSE.md"],
      excludedExportPaths: ["data.json", "main.js", "styles.css", "release"],
      recursiveExcludedExportNames: ["data.json", ".git", "node_modules", ".obsidian", ".codex", ".chatobby", ".chatobby-mcp-replies"],
    }),
  );
  await fixtureFile(root, "tests/.gitkeep", "");
  if (complete) await fixtureFile(root, "LICENSE.md", "Synthetic unchanged license text.\n");
  commitFiles(root, ["README.md", "RELEASE_NOTES_0.3.2.md", "RELEASE_NOTES_latest.md", "src/main.ts", "boundary-manifest.json", "tests/.gitkeep", ...(complete ? ["LICENSE.md"] : [])]);
}
