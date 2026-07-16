import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

const repositoryRoot = resolve(import.meta.dirname, "..");
const featuresRoot = join(repositoryRoot, "src", "features");
const failures = [];

for (const featureName of readdirSync(featuresRoot)) {
  const featureRoot = join(featuresRoot, featureName);
  if (!statSync(featureRoot).isDirectory()) continue;
  const publicPath = join(featureRoot, "public.ts");
  let source;
  try {
    source = readFileSync(publicPath, "utf8");
  } catch {
    failures.push(`src/features/${featureName} is missing public.ts`);
    continue;
  }
  const file = ts.createSourceFile(publicPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of file.statements) {
    if (!ts.isExportDeclaration(statement) && !hasExportModifier(statement)) continue;
    const prefix = source.slice(0, statement.getStart(file));
    const previousNonEmptyLine = prefix.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) ?? "";
    if (!previousNonEmptyLine.endsWith("*/")) {
      const line = file.getLineAndCharacterOfPosition(statement.getStart(file)).line + 1;
      failures.push(`${relative(repositoryRoot, publicPath)}:${line} export is missing API documentation`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Public API documentation check passed.");
}

function hasExportModifier(node) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}
