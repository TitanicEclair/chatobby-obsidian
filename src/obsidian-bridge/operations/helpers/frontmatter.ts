// Frontmatter helpers — read / merge / serialize the leading YAML frontmatter block.
//
// Production path uses Obsidian's app.fileManager.processFrontMatter, which
// round-trips YAML correctly (handles nested values, dates, multiline). The
// manual fallback below is a *bounded subset* (scalars + scalar lists) used when
// fileManager is unavailable (tests, non-markdown). It throws INVALID_INPUT on
// anything it cannot faithfully round-trip rather than silently corrupting FM.
//
// No external YAML dependency — keeps the plugin bundle dependency-free.

import { BridgeError } from "../../types";

/** A split of note content into frontmatter text and body. */
export interface FrontmatterSplit {
  /** Raw frontmatter text (between the `---` fences), without the fences. null if absent. */
  fmText: string | null;
  /** Body content (everything after the frontmatter block). */
  body: string;
  /** True when a leading `--- ... ---` block was found. */
  hasFrontmatter: boolean;
}

const FM_FENCE = /^---\s*$/;

/**
 * Split note content into a leading frontmatter block and the body.
 * A frontmatter block is `---` on the first line, `---` on a later line.
 */
export function splitFrontmatter(content: string): FrontmatterSplit {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || !FM_FENCE.test(lines[0]!)) {
    return { fmText: null, body: content, hasFrontmatter: false };
  }
  // Find the closing fence (line > 0).
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FM_FENCE.test(lines[i]!)) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    // Opening fence with no close — not a valid frontmatter block; treat all as body.
    return { fmText: null, body: content, hasFrontmatter: false };
  }
  const fmText = lines.slice(1, closeIdx).join("\n");
  const body = lines.slice(closeIdx + 1).join("\n");
  return { fmText, body, hasFrontmatter: true };
}

/** Parse a scalar YAML value (string/number/boolean/null). Throws on unsupported. */
function parseScalar(raw: string): unknown {
  const v = raw.trim();
  if (v === "") return null;
  // Quoted string
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  // Number
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
  // Plain string (no inline maps / anchors)
  if (/[:{}[\]&*!|>%@`]/.test(v)) {
    throw new BridgeError("INVALID_INPUT", `Unsupported frontmatter scalar: ${raw}`);
  }
  return v;
}

/** Parse an inline `[a, b, c]` sequence of scalars. Returns null if not a sequence. */
function tryParseInlineSequence(raw: string): unknown[] | null {
  const v = raw.trim();
  if (!(v.startsWith("[") && v.endsWith("]"))) return null;
  const inner = v.slice(1, -1).trim();
  if (inner === "") return [];
  return inner.split(",").map((part) => parseScalar(part));
}

/**
 * Parse a frontmatter text block (bounded YAML subset) into an object.
 * Supports: `key: scalar`, `key: [inline, sequence]`, and block sequences of scalars.
 * Throws INVALID_INPUT on nested maps, multiline strings, or other unsupported forms.
 */
export function parseFrontmatter(fmText: string): Record<string, unknown> {
  const lines = fmText.split(/\r?\n/);
  const out: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "" || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const m = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      throw new BridgeError("INVALID_INPUT", `Malformed frontmatter line: ${line}`);
    }
    const key = m[1]!;
    const rest = m[2] ?? "";
    if (rest.trim() === "") {
      // Maybe a block sequence follows.
      const seq: unknown[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j]!)) {
        const itemRaw = lines[j]!.replace(/^\s*-\s+/, "");
        seq.push(parseScalar(itemRaw));
        j++;
      }
      if (seq.length > 0) {
        out[key] = seq;
        i = j;
        continue;
      }
      out[key] = null;
      i++;
      continue;
    }
    const inline = tryParseInlineSequence(rest);
    if (inline) {
      out[key] = inline;
    } else {
      out[key] = parseScalar(rest);
    }
    i++;
  }
  return out;
}

/** Serialize a scalar to a YAML fragment. */
function serializeScalar(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    // Quote if empty, or if it could be mistaken for another type / contains special chars.
    if (v === "" || /[:#{}[\],&*!|>'"%@`"\n]|^\s|\s$|^(true|false|null|~|-?\d)/.test(v)) {
      return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return v;
  }
  throw new BridgeError("INVALID_INPUT", `Unsupported frontmatter value type: ${typeof v}`);
}

/** Serialize a bounded frontmatter object back to YAML text (no trailing newline). */
export function serializeFrontmatter(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${serializeScalar(item)}`);
        }
      }
    } else if (value !== null && typeof value === "object") {
      throw new BridgeError("INVALID_INPUT", `Nested objects in frontmatter are unsupported (key: ${key})`);
    } else {
      lines.push(`${key}: ${serializeScalar(value)}`);
    }
  }
  return lines.join("\n");
}

/**
 * Merge `updates` into the frontmatter of `content`.
 * - A null/undefined value in `updates` deletes the key.
 * - Creates a frontmatter block if none exists.
 * Returns the new full content and whether anything changed.
 */
export function mergeFrontmatter(
  content: string,
  updates: Record<string, unknown>,
): { content: string; changed: boolean } {
  const split = splitFrontmatter(content);
  const existing = split.fmText !== null ? parseFrontmatter(split.fmText) : {};
  let changed = false;

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) {
      if (key in existing) {
        delete existing[key];
        changed = true;
      }
      continue;
    }
    if (!(key in existing) || !scalarEqual(existing[key], value)) {
      existing[key] = value;
      changed = true;
    }
  }

  if (!changed) return { content, changed: false };

  const fmText = serializeFrontmatter(existing);
  // Preserve a blank line between frontmatter and body if the body is non-empty.
  const body = split.body.replace(/^\n/, "");
  const newContent = split.hasFrontmatter || fmText.length > 0
    ? `---\n${fmText}\n---\n${body}`
    : body;
  return { content: newContent, changed: true };
}

function scalarEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => scalarEqual(v, b[i]));
  }
  return a === b;
}
