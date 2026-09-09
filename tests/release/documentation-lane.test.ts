import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(import.meta.dirname, "../../scripts/classify-documentation-lane.mjs");
const classify = (...paths: string[]): string => JSON.parse(execFileSync(process.execPath, [script, ...paths], { encoding: "utf8" })).lane;

describe("connector documentation release lane", () => {
  it("selects README-only documentation without frontend/runtime checks", () => {
    expect(classify("README.md")).toBe("documentation-only");
  });

  it("selects minimal artifact proof for an intentional identity bump", () => {
    expect(classify("README.md", "manifest.json", "package.json")).toBe("documentation-version-release");
  });

  it("fails closed to normal checks for code or generated protocol changes", () => {
    expect(classify("src/main.ts")).toBe("full-code");
    expect(classify("src/vendor/chatobby-client/control/contracts.ts")).toBe("full-code");
  });
});
