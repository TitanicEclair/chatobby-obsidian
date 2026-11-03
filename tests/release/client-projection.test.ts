import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (!directory.startsWith(join(tmpdir(), "chatobby-client-order-"))) throw new Error("Unexpected fixture root");
    rmSync(directory, { recursive: true, force: true });
  }
});

/** Run the real verifier against a bounded fake checkout. This protects canonical
 * ordinal inventories; public parser semantics are covered by project-screen-contract.test.ts.
 * See docs/architecture/frontend-modules.md#projects-contract-boundary.
 */
describe("client projection inventory verification", () => {
  it("accepts canonical ordinal paths including README before lowercase contract files", () => {
    const fixture = projection();
    expect(fixture.run()).toMatchObject({ status: 0, stderr: "" });
  });

  it.each(["sourceFiles", "files"] as const)("rejects reordered or duplicate %s even with a refreshed source hash", key => {
    const fixture = projection();
    fixture.manifest[key].reverse();
    expect(fixture.run().stderr).toContain("inventory is not unique and sorted");
    fixture.manifest[key].reverse();
    fixture.manifest[key].splice(1, 0, fixture.manifest[key][0]!);
    expect(fixture.run().stderr).toContain("inventory is not unique and sorted");
  });

  it("still rejects altered bytes and files omitted from the receipt", () => {
    const fixture = projection();
    writeFileSync(join(fixture.vendor, "frontend/README.md"), "contract owners\n");
    expect(fixture.run().stderr).toContain("Generated client file drifted: frontend/README.md");
    writeFileSync(join(fixture.vendor, "extra.ts"), "export {};");
    expect(fixture.run().stderr).toContain("Generated client file set drifted");
  });
});

function projection() {
  const root = mkdtempSync(join(tmpdir(), "chatobby-client-order-"));
  directories.push(root);
  const vendor = join(root, "src/vendor/chatobby-client"), script = join(root, "scripts/check-chatobby-client-projection.mjs");
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(vendor, "frontend"), { recursive: true });
  copyFileSync(resolve("scripts/check-chatobby-client-projection.mjs"), script);
  // Only the verifier's advertised textual markers are needed; these are not parser implementations.
  const artifacts = [
    { path: "frontend-contracts.ts", text: "// CHATOBBY_FRONTEND_PROTOCOL_VERSION = 2\n// parseFrontendPatch parseFrontendSubscriptionResult parseFrontendScreenResponse parseFrontendIntentResult parseFrontendProtocolError\n" },
    { path: "frontend/README.md", text: "Contract owners\n" },
    { path: "frontend/choices.ts", text: "export {};\n" },
    { path: "ws-client.ts", text: "export {};\n" },
  ];
  for (const file of artifacts) writeFileSync(join(vendor, file.path), file.text);
  const sourceFiles = artifacts.map(file => ({ path: file.path, sha256: digest(file.text) }));
  const manifest = {
    schemaVersion: 1, artifact: "chatobby-client", contractSurface: "complete-package-entry-closure", protocolVersion: 2,
    sourceRevision: "a".repeat(40), sourceFiles, sourceContentSha256: "",
    files: artifacts.map(file => ({ path: file.path, sha256: digest(file.text), size: Buffer.byteLength(file.text) })),
  };
  return { vendor, manifest, run() {
    manifest.sourceContentSha256 = digest(JSON.stringify(manifest.sourceFiles));
    writeFileSync(join(vendor, "projection.json"), JSON.stringify(manifest));
    return spawnSync(process.execPath, [script], { encoding: "utf8", windowsHide: true, timeout: 5000 });
  } };
}
