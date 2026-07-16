// Markdown task (checkbox) helpers — parse and toggle `- [ ]` / `- [x]` / `- [-]` lines.
// Used by the tasks.list and tasks.update plugin-native operations.
//
// Bounded to Obsidian's checkbox syntax. No external deps.

export type TaskStatus = "unchecked" | "checked" | "in_progress" | "cancelled";

export interface TaskItem {
  path: string;
  /** 0-based line number of the task within the note. */
  line: number;
  text: string;
  status: TaskStatus;
  checked: boolean;
}

const TASK_RE = /^(\s*[-*+]\s+)\[([ xX\->])\]\s+(.*)$/;

function charToStatus(ch: string): TaskStatus {
  if (ch === " ") return "unchecked";
  if (ch === "x" || ch === "X") return "checked";
  if (ch === ">") return "in_progress";
  return "cancelled"; // '-' or anything else
}

function statusToChar(status: TaskStatus): string {
  if (status === "checked") return "x";
  if (status === "in_progress") return ">";
  if (status === "cancelled") return "-";
  return " ";
}

/**
 * Parse task items from note content.
 * @param includeCompleted when false, only unchecked/cancelled tasks are returned.
 */
export function parseTasks(path: string, content: string, includeCompleted: boolean): TaskItem[] {
  const lines = content.split(/\r?\n/);
  const out: TaskItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = TASK_RE.exec(lines[i]!);
    if (!m) continue;
    const status = charToStatus(m[2]!);
    if (!includeCompleted && status === "checked") continue;
    out.push({ path, line: i, text: m[3] ?? "", status, checked: status === "checked" });
  }
  return out;
}

/**
 * Set the status of the task at `line` (0-based). Returns the new content and
 * whether a change was made. Throws if the line is not a task line.
 */
export function setTaskStatus(
  content: string,
  line: number,
  status: TaskStatus,
): { content: string; changed: boolean } {
  const lines = content.split(/\r?\n/);
  if (line < 0 || line >= lines.length) {
    throw new RangeError(`Task line ${line} is out of range (0..${lines.length - 1})`);
  }
  const m = TASK_RE.exec(lines[line]!);
  if (!m) {
    throw new RangeError(`Line ${line} is not a task line`);
  }
  const marker = m[2]!;
  const want = statusToChar(status);
  const newLine = `${m[1]}[${want}] ${m[3] ?? ""}`;
  if (marker === want || newLine === lines[line]) return { content, changed: false };
  lines[line] = newLine;
  return { content: lines.join("\n"), changed: true };
}
