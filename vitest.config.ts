import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./tests/ui/helpers/obsidian-runtime.ts", import.meta.url)),
      "@chatobby/obsidian-protocol": fileURLToPath(
        new URL("./src/vendor/@chatobby/obsidian-protocol/index.js", import.meta.url),
      ),
    },
  },
  test: {
    // Bound process-heavy fixtures so parallel repository work cannot exhaust their deadlines.
    maxWorkers: 2,
    environment: "happy-dom",
    exclude: [...configDefaults.exclude, "**/.claude/**"],
    setupFiles: ["tests/ui/helpers/dom-shim.ts"],
  },
});
