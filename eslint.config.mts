import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "release",
    "main.js",
    "styles.css",
    "scripts",
    "tests",
    "vitest.config.ts",
    "src/vendor/@chatobby/obsidian-protocol/**/*.d.ts",
    "src/vendor/@chatobby/obsidian-protocol/**/*.js",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "versions.json",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mts", "manifest.json"],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    rules: {
      // The hosted community scanner disables these general style rules. Keep
      // the local release gate aligned instead of rewriting product names or
      // coercing validated protocol values only to satisfy stricter defaults.
      "obsidianmd/ui/sentence-case": "off",
      // Declarative settings require Obsidian 1.13; the public plugin still
      // supports its declared 1.8 minimum through PluginSettingTab.display().
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
);
