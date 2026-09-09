import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("developer documentation", () => {
  it("keeps local Markdown link targets present", () => {
    const missing: string[] = [];

    for (const markdownPath of markdownFiles()) {
      const source = readFileSync(markdownPath, "utf8");
      for (const target of inlineMarkdownTargets(source)) {
        const localPath = localTargetPath(target);
        if (localPath === null) continue;

        const resolved = resolve(dirname(markdownPath), localPath);
        if (!existsSync(resolved)) {
          missing.push(`${relative(repositoryRoot, markdownPath)} -> ${target}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("keeps source-code documentation references present", () => {
    const missing: string[] = [];

    for (const sourcePath of walkSource(join(repositoryRoot, "src"))) {
      const source = readFileSync(sourcePath, "utf8");
      for (const match of source.matchAll(/docs\/[A-Za-z\d_./-]+\.md/gu)) {
        const target = match[0];
        if (!existsSync(join(repositoryRoot, target))) {
          missing.push(`${relative(repositoryRoot, sourcePath)} -> ${target}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});

function markdownFiles(): string[] {
  const roots = [
    ...readdirSync(repositoryRoot)
      .filter((name) => name.endsWith(".md"))
      .map((name) => join(repositoryRoot, name)),
    ...walkMarkdown(join(repositoryRoot, "docs")),
  ];
  return roots.sort();
}

function walkMarkdown(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walkMarkdown(path));
    } else if (entry.endsWith(".md")) {
      files.push(path);
    }
  }
  return files;
}

function walkSource(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "vendor") files.push(...walkSource(path));
    } else if (entry.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function inlineMarkdownTargets(source: string): string[] {
  return [...source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((target) => target.length > 0);
}

function localTargetPath(target: string): string | null {
  const unwrapped = target.startsWith("<")
    ? target.slice(1, target.indexOf(">"))
    : target.split(/\s+["']/u, 1)[0] ?? "";
  const withoutAnchor = unwrapped.split("#", 1)[0]?.split("?", 1)[0] ?? "";
  if (
    withoutAnchor.length === 0 ||
    withoutAnchor.startsWith("/") ||
    /^[a-z][a-z\d+.-]*:/iu.test(withoutAnchor)
  ) {
    return null;
  }

  try {
    return decodeURIComponent(withoutAnchor);
  } catch {
    return withoutAnchor;
  }
}
