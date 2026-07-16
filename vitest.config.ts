import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./tests/ui/helpers/obsidian-runtime.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    exclude: [...configDefaults.exclude, "**/.claude/**"],
    setupFiles: ["tests/ui/helpers/dom-shim.ts"],
  },
});
