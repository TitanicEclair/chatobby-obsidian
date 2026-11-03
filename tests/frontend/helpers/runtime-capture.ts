import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

// @see docs/api/feed.md#paired-runtime-projection-regression
export const CAPTURE_CHILD_TIMEOUT_MS = 15_000;
export const CAPTURE_ENCLOSING_TIMEOUT_MS = CAPTURE_CHILD_TIMEOUT_MS + 5_000;

/** Test-only Node child: complete stdout is usable only after a successful exit. */
export function captureNode(script: string, cwd: string, timeoutMs = CAPTURE_CHILD_TIMEOUT_MS): string {
  const started = performance.now();
  const result = spawnSync(process.execPath, [script], {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error?.message.slice(0, 512) ?? "unsuccessful child exit";
    const stderr = (result.stderr ?? "").slice(-4096);
    throw new Error(
      `Runtime feed capture failed: ${reason}; timeoutMs=${timeoutMs}; status=${result.status}; `
      + `signal=${result.signal}; elapsedMs=${Math.round(performance.now() - started)}; `
      + `stdoutBytes=${Buffer.byteLength(result.stdout ?? "")}\n${stderr}`,
    );
  }
  return result.stdout;
}
