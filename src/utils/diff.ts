// Line-level unified diff (LCS-based) with context windows and hunk separation.
// Pure, no deps. Used by the bridge (note.edit) to attach a diff to its result, and by the
// edit-tool renderer to show hunks with "⋯ N lines hidden" separators for far-apart changes.

export interface DiffLine {
  type: "context" | "add" | "del";
  text: string;
}

export interface DiffHunk {
  /** 1-based old line number where the hunk starts. */
  oldStart: number;
  /** Number of old lines the hunk covers. */
  oldCount: number;
  /** 1-based new line number where the hunk starts. */
  newStart: number;
  /** Number of new lines the hunk covers. */
  newCount: number;
  lines: DiffLine[];
}

/** Lines beyond this are not diffed (O(m·n) LCS guard); returns []. */
const MAX_LINES = 1500;

/** Compute unified-diff hunks (with `context` lines around each change) between two texts. */
export function computeDiff(oldText: string, newText: string, context = 3): DiffHunk[] {
  if (oldText === newText) return [];
  const a = oldText.split("\n");
  const b = newText.split("\n");
  if (a.length > MAX_LINES || b.length > MAX_LINES) return [];
  const lines = lcsDiff(a, b);
  return toHunks(lines, context);
}

/** LCS-based line diff → ordered list of context/add/del lines. */
function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const m = a.length;
  const n = b.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i -= 1) {
    const cur = dp[i]!;
    const below = dp[i + 1]!;
    for (let j = n - 1; j >= 0; j -= 1) {
      cur[j] = a[i] === b[j] ? below[j + 1]! + 1 : Math.max(below[j]!, cur[j + 1]!);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "context", text: a[i]! });
      i += 1;
      j += 1;
    } else {
      const down = dp[i + 1]![j]!;
      const right = dp[i]![j + 1]!;
      if (down >= right) {
        out.push({ type: "del", text: a[i]! });
        i += 1;
      } else {
        out.push({ type: "add", text: b[j]! });
        j += 1;
      }
    }
  }
  while (i < m) {
    out.push({ type: "del", text: a[i]! });
    i += 1;
  }
  while (j < n) {
    out.push({ type: "add", text: b[j]! });
    j += 1;
  }
  return out;
}

/** Group diff lines into hunks, each with `context` lines of surrounding context. Adjacent
 *  changes (within 2·context lines) merge into one hunk; distant changes become separate hunks. */
function toHunks(lines: DiffLine[], context: number): DiffHunk[] {
  const count = lines.length;
  // Running 1-based old/new line numbers at each diff-line index.
  const runOld: number[] = [1];
  const runNew: number[] = [1];
  for (const line of lines) {
    runOld.push(runOld[runOld.length - 1]! + (line.type === "add" ? 0 : 1));
    runNew.push(runNew[runNew.length - 1]! + (line.type === "del" ? 0 : 1));
  }

  const changes: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (lines[i]!.type !== "context") changes.push(i);
  }
  if (changes.length === 0) return [];

  const hunks: DiffHunk[] = [];
  let start = Math.max(0, changes[0]! - context);
  let end = Math.min(count - 1, changes[0]! + context);
  for (let k = 1; k < changes.length; k += 1) {
    const changeStart = Math.max(0, changes[k]! - context);
    if (changeStart <= end + 1) {
      end = Math.min(count - 1, changes[k]! + context);
    } else {
      hunks.push(buildHunk(lines, start, end, runOld, runNew));
      start = changeStart;
      end = Math.min(count - 1, changes[k]! + context);
    }
  }
  hunks.push(buildHunk(lines, start, end, runOld, runNew));
  return hunks;
}

function buildHunk(lines: DiffLine[], start: number, end: number, runOld: number[], runNew: number[]): DiffHunk {
  return {
    oldStart: runOld[start]!,
    oldCount: runOld[end + 1]! - runOld[start]!,
    newStart: runNew[start]!,
    newCount: runNew[end + 1]! - runNew[start]!,
    lines: lines.slice(start, end + 1),
  };
}
