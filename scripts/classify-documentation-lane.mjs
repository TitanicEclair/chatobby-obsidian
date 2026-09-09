const paths = [...new Set(process.argv.slice(2).map((path) => path.replaceAll("\\", "/").replace(/^\.\//u, "")).filter(Boolean))].sort();
const documentation = new Set(["README.md"]);
const identity = new Set([
  "manifest.json",
  "package.json",
  "versions.json",
  "src/vendor/chatobby-client/control/product.generated.ts",
  "src/vendor/chatobby-client/control/product.generated.d.ts",
]);

let lane = "full-code";
if (paths.length > 0 && paths.every((path) => documentation.has(path))) lane = "documentation-only";
else if (paths.length > 0 && paths.every((path) => documentation.has(path) || identity.has(path))) {
  lane = "documentation-version-release";
}
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, lane, paths })}\n`);
