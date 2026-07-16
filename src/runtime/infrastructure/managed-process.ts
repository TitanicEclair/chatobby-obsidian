import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { appendFile, rename, rm, stat } from "node:fs/promises";
import type { Readable } from "node:stream";
import type {
  ManagedProcessExit,
  ManagedProcessHandle,
  ManagedRuntimeLaunch,
} from "../contracts";

const LOG_RING_LINES = 120;
const LOG_ROTATE_BYTES = 1_000_000;
const TERMINATE_TIMEOUT_MS = 5_000;

export interface ManagedProcessLauncher {
  spawn(launch: ManagedRuntimeLaunch): Promise<ManagedProcessHandle>;
}

/** Spawn one exact runtime child and retain only bounded diagnostics in memory. */
export class NodeManagedProcessLauncher implements ManagedProcessLauncher {
  async spawn(launch: ManagedRuntimeLaunch): Promise<ManagedProcessHandle> {
    await rotateLog(launch.env.CHATOBBY_RUNTIME_LOG_FILE);
    const logFile = launch.env.CHATOBBY_RUNTIME_LOG_FILE;
    const logDescriptor = launch.detached && logFile ? openSync(logFile, "a") : undefined;
    const child = spawn(launch.command, launch.args, {
      cwd: launch.cwd,
      env: { ...process.env, ...launch.env },
      shell: false,
      windowsHide: true,
      detached: launch.detached,
      stdio: launch.detached
        ? ["ignore", logDescriptor ?? "ignore", logDescriptor ?? "ignore"]
        : "pipe",
    });
    const logs: string[] = [];
    const startedAt = Date.now();
    if (child.stdout) capture(child.stdout, "stdout", logs, logFile);
    if (child.stderr) capture(child.stderr, "stderr", logs, logFile);

    let expected = false;
    let terminatePromise: Promise<void> | null = null;
    let resolveExit!: (exit: ManagedProcessExit) => void;
    const exited = new Promise<ManagedProcessExit>((resolve) => {
      resolveExit = resolve;
    });
    child.once("exit", (code, signal) => resolveExit({ code, signal, expected }));

    try {
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
    } finally {
      if (logDescriptor !== undefined) closeSync(logDescriptor);
    }
    if (child.pid === undefined) throw new Error("Chatobby runtime spawned without a process id");
    if (launch.detached) child.unref();

    return {
      pid: child.pid,
      startedAt,
      exited,
      recentLogs: () => [...logs],
      terminate: () => {
        expected = true;
        if (!terminatePromise) terminatePromise = terminateExactChild(child, exited);
        return terminatePromise;
      },
    };
  }
}

function capture(
  output: Readable,
  stream: "stdout" | "stderr",
  logs: string[],
  logFile: string | undefined,
): void {
  output.on("data", (chunk: Buffer) => {
    const timestamp = new Date().toISOString();
    const lines = chunk.toString("utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const entry = `${timestamp} ${stream}: ${line}`;
      logs.push(entry);
      if (logs.length > LOG_RING_LINES) logs.splice(0, logs.length - LOG_RING_LINES);
      if (logFile) void appendFile(logFile, `${entry}\n`, "utf8").catch(() => {});
    }
  });
}

async function terminateExactChild(
  child: ChildProcess,
  exited: Promise<ManagedProcessExit>,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform !== "win32") child.kill("SIGTERM");
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), TERMINATE_TIMEOUT_MS)),
  ]);
  if (stopped) return;

  if (process.platform === "win32" && child.pid !== undefined) {
    await runTaskkill(child.pid);
  } else {
    child.kill("SIGKILL");
  }
  await Promise.race([
    exited.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, TERMINATE_TIMEOUT_MS)),
  ]);
}

function runTaskkill(pid: number): Promise<void> {
  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      shell: false,
      windowsHide: true,
    });
    killer.once("error", () => resolve());
    killer.once("exit", () => resolve());
  });
}

async function rotateLog(logFile: string | undefined): Promise<void> {
  if (!logFile) return;
  try {
    if ((await stat(logFile)).size < LOG_ROTATE_BYTES) return;
    const rotated = `${logFile}.1`;
    await rm(rotated, { force: true });
    await rename(logFile, rotated);
  } catch {
    // A missing or inaccessible diagnostic log must not block runtime startup.
  }
}
