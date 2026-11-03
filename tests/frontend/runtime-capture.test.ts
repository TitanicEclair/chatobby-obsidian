// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CAPTURE_CHILD_TIMEOUT_MS, CAPTURE_ENCLOSING_TIMEOUT_MS, captureNode } from "./helpers/runtime-capture";

// @see docs/api/feed.md#paired-runtime-projection-regression
// Real local Node children and a nested Vitest runner; no source checkout or provider.
const roots: string[] = [];
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(source: string) {
  const root = mkdtempSync(join(tmpdir(), "chatobby-capture-budget-"));
  roots.push(root);
  const script = join(root, "capture.mjs");
  writeFileSync(script, source);
  return { root, script };
}

describe("paired capture child lifetime", () => {
  it("waits beyond complete stdout until the child finishes its last work and exits", () => {
    const { root, script } = fixture(`
      import { writeFileSync } from 'node:fs';
      process.stdout.write('{"complete":true}');
      setTimeout(() => writeFileSync('finished.txt', 'finished'), 150);
    `);
    expect(JSON.parse(captureNode(script, root))).toEqual({ complete: true });
    expect(readFileSync(join(root, "finished.txt"), "utf8")).toBe("finished");
  });

  it("rejects completed stdout when the child later exits unsuccessfully", () => {
    const { root, script } = fixture(`
      process.stdout.write('{"complete":true}');
      setTimeout(() => process.exit(7), 150);
    `);
    expect(() => captureNode(script, root)).toThrow(/status=7;.*stdoutBytes=17/s);
  });

  it.each([false, true])("rejects a timed-out child even when completed stdout exists: %s", (withOutput) => {
    const { root, script } = fixture(`
      ${withOutput ? "process.stdout.write('{\"complete\":true}');" : ""}
      process.stderr.write('x'.repeat(6000) + '\\n[capture-history] capture-complete\\n');
      setInterval(() => {}, 1000);
    `);
    let failure: Error | undefined;
    try { captureNode(script, root, 1000); } catch (error) {
      if (!(error instanceof Error)) throw error;
      failure = error;
    }
    expect(failure?.message).toContain("ETIMEDOUT");
    expect(failure?.message).toContain(`stdoutBytes=${withOutput ? 17 : 0}`);
    expect(failure?.message).toContain("[capture-history] capture-complete");
    expect(failure!.message.length).toBeLessThan(5000);
  });

  it("gives setup and repeat capture explicit budgets above runner defaults", () => {
    const { root, script } = fixture("process.stdout.write('{\"complete\":true}');");
    const testFile = join(root, "budget.test.ts");
    const config = join(root, "vitest.config.mjs");
    const report = join(root, "result.json");
    const importPath = (path: string) => JSON.stringify(path.replaceAll("\\", "/"));
    const captureImport = importPath(join(repositoryRoot, "tests/frontend/helpers/runtime-capture.ts"));
    const vitestImport = importPath(join(repositoryRoot, "node_modules/vitest/dist/index.js"));
    writeFileSync(config, `export default ${JSON.stringify({
      root, test: { include: ["budget.test.ts"], environment: "node", maxWorkers: 1,
        hookTimeout: 50, testTimeout: 50, reporters: ["default", "json"], outputFile: report },
    })};`);
    function run(hookBudget: boolean, testBudget: boolean) {
      // An awaited delay yields to Vitest's timer; spawnSync alone would mask it.
      writeFileSync(testFile, `
        import { beforeAll, expect, it } from ${vitestImport};
        import { setTimeout as delay } from 'node:timers/promises';
        import { captureNode, CAPTURE_ENCLOSING_TIMEOUT_MS } from ${captureImport};
        const capture = async () => { await delay(200); return captureNode(${JSON.stringify(script)}, ${JSON.stringify(root)}); };
        beforeAll(capture${hookBudget ? ", CAPTURE_ENCLOSING_TIMEOUT_MS" : ""});
        it('repeat capture', async () => { expect(JSON.parse(await capture())).toEqual({complete:true}); }${testBudget ? ", CAPTURE_ENCLOSING_TIMEOUT_MS" : ""});
      `);
      return spawnSync(process.execPath, [join(repositoryRoot, "node_modules/vitest/vitest.mjs"), "run", "--config", config], {
        cwd: repositoryRoot, encoding: "utf8", timeout: CAPTURE_CHILD_TIMEOUT_MS, windowsHide: true,
      });
    }
    const inheritedHook = run(false, true);
    expect(inheritedHook.error).toBeUndefined();
    expect(inheritedHook.status).toBe(1);
    expect(inheritedHook.stdout + inheritedHook.stderr).toContain("Hook timed out in 50ms");
    const inheritedTest = run(true, false);
    expect(inheritedTest.error).toBeUndefined();
    expect(inheritedTest.status).toBe(1);
    expect(inheritedTest.stdout + inheritedTest.stderr).toContain("Test timed out in 50ms");
    const explicit = run(true, true);
    expect(explicit.error).toBeUndefined();
    expect(explicit.status, explicit.stderr || explicit.stdout).toBe(0);
    expect(JSON.parse(readFileSync(report, "utf8"))).toMatchObject({ success: true, numPassedTests: 1 });
  }, CAPTURE_CHILD_TIMEOUT_MS * 3 + CAPTURE_ENCLOSING_TIMEOUT_MS);
});
