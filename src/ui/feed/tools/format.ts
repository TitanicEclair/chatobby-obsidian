// Shared formatting for tool-call rendering. The per-category renderer files were collapsed
// into this one module — they were 8 near-identical "dump args/result as text" stubs.
//
// A tool call renders as a compact row (icon + name + primary arg + status dot) that expands
// to a formatted result. See docs/ui-state-guide.md § Tool rendering.

import type { ImageContent, ToolItem } from "../../../types";
import { TOOL_RESULT_TRUNCATE_LINES } from "../../shared/constants";
import type { DiffHunk } from "../../../utils/diff";

/** Argument keys that carry the "what file/query/command" of a call, in priority order. */
const PRIMARY_ARG_KEYS = [
  "path", "file", "note", "name", "query", "command", "pattern",
  "source", "destination", "folder", "ref", "linktext", "subjectPath", "url",
  "description", "run_id", "channel_id", "skill_id", "profile_id", "workflow_id", "role_id", "agent",
] as const;

/** Extract the one argument that identifies what the tool acted on (a path, query, etc.). */
export function primaryArgument(item: ToolItem): string {
  const parsed = safeParseObject(item.arguments);
  if (!parsed) return "";
  if (item.name.toLowerCase() === "mcp" && typeof parsed.tool === "string") {
    const nested = typeof parsed.args === "string" ? parsed.args : "";
    return primaryArgument({ ...item, name: parsed.tool, arguments: nested }) || parsed.tool;
  }
  for (const key of PRIMARY_ARG_KEYS) {
    const value = parsed[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

/** One-line fallback when a tool has no semantic path/query/command enhancer. */
export function inputPreview(item: ToolItem): string {
  const parsed = safeParseObject(item.arguments);
  const raw = parsed ? JSON.stringify(parsed) : item.arguments.trim();
  if (!raw || raw === "{}") return "";
  return raw.length > 140 ? `${raw.slice(0, 137)}...` : raw;
}

export interface ToolChangeStats {
  additions: number;
  deletions: number;
}

/** Chaude-style +N/-M file-change stats for compact tool rows. */
export function toolChangeStats(item: ToolItem): ToolChangeStats | null {
  const resultDiff = extractDiff(item.result);
  if (resultDiff && resultDiff.length > 0) {
    return compactStats({
      additions: countDiffLines(resultDiff, "add"),
      deletions: countDiffLines(resultDiff, "del"),
    });
  }

  const parsed = safeParseObject(item.arguments);
  if (!parsed) return null;
  const name = item.name.toLowerCase();
  const edits = Array.isArray(parsed.edits) ? parsed.edits : null;

  if (edits) {
    const stats = edits.reduce<ToolChangeStats>((total, value) => {
      const edit = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return {
        additions: total.additions + lineCount(stringField(edit, ["new_string", "newContent", "new_content"])),
        deletions: total.deletions + lineCount(stringField(edit, ["old_string", "oldContent", "old_content"])),
      };
    }, { additions: 0, deletions: 0 });
    return compactStats(stats);
  }

  if (/(write|create)/.test(name)) {
    return compactStats({
      additions: lineCount(stringField(parsed, ["content", "text", "markdown", "new_string", "newContent", "new_content"])),
      deletions: 0,
    });
  }

  if (/(delete|remove|trash)/.test(name)) {
    return compactStats({
      additions: 0,
      deletions: lineCount(stringField(parsed, ["content", "old_string", "oldContent", "old_content"])),
    });
  }

  if (/(edit|update|append|prepend|replace)/.test(name)) {
    return compactStats({
      additions: lineCount(stringField(parsed, ["new_string", "newContent", "new_content", "content", "text", "markdown"])),
      deletions: lineCount(stringField(parsed, ["old_string", "oldContent", "old_content"])),
    });
  }

  return null;
}

/** Whether the argument value is an external URL (as opposed to a vault path). */
export function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

/** Whether the argument value looks like a vault path (not a URL, not a shell command). */
export function looksLikeVaultPath(value: string): boolean {
  if (!value || isExternalUrl(value)) return false;
  // Shell commands and search queries usually have spaces or shell metacharacters.
  if (/[\s|&;><$`!(){}[\]*?#~]/.test(value)) return false;
  // Must have a file extension or look like a directory path.
  return /\.(md|canvas|png|jpg|jpeg|gif|svg|webp|pdf|json|yaml|yml|css|js|ts|txt|csv)$/i.test(value) ||
         /^\//.test(value) ||
         /^[A-Za-z]/.test(value);
}

/** Render the tool detail: tool name + full input, then the result/diff below. */
export function renderToolDetail(container: HTMLElement, item: ToolItem): void {
  container.empty();
  const isError = item.isError === true;

  // Tool name + full arguments (untruncated) above the result.
  const header = container.createDiv({ cls: "chatobby-tool-detail__header" });
  header.createSpan({ cls: "chatobby-tool-detail__name", text: item.name });
  const args = formatArgs(item.arguments);
  if (args) {
    header.createEl("pre", { cls: "chatobby-tool-detail__args", text: args });
  }

  // Result / diff below.
  const diff = extractDiff(item.result);
  if (diff && diff.length > 0) {
    renderDiffHunks(container, diff);
    return;
  }

  if (Array.isArray(item.result) && item.result.some(isImageContent)) {
    renderMixedToolResult(container, item.result, isError);
    return;
  }

  const text = stringify(item.result ?? "");
  if (!text) return;
  const pre = container.createEl("pre", { cls: isError ? "chatobby-tool-result is-error" : "chatobby-tool-result" });
  pre.textContent = truncateLines(text);
}

function renderMixedToolResult(container: HTMLElement, result: unknown[], isError: boolean): void {
  const wrap = container.createDiv({ cls: "chatobby-tool-result-mixed" });
  for (const item of result) {
    if (isTextContent(item)) {
      const pre = wrap.createEl("pre", { cls: isError ? "chatobby-tool-result is-error" : "chatobby-tool-result" });
      pre.textContent = truncateLines(item.text);
    } else if (isImageContent(item)) {
      const card = wrap.createDiv({ cls: "chatobby-media-card" });
      card.createEl("img", {
        cls: "chatobby-media-card__image",
        attr: { src: imageSource(item), alt: `Tool result ${item.mimeType || "image"}` },
      });
      const meta = card.createDiv({ cls: "chatobby-media-card__meta" });
      meta.createSpan({ cls: "chatobby-media-card__label", text: item.mimeType || "image" });
    }
  }
}

/** Format tool arguments for display (always the full JSON, never truncated). */
function formatArgs(raw: string): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

/** Pull a precomputed diff off an edit tool's result envelope (note.edit attaches one). */
function extractDiff(result: unknown): DiffHunk[] | null {
  if (result && typeof result === "object" && Array.isArray((result as { diff?: unknown }).diff)) {
    return (result as { diff: DiffHunk[] }).diff;
  }
  return null;
}

function countDiffLines(hunks: DiffHunk[], type: "add" | "del"): number {
  return hunks.reduce((total, hunk) => total + hunk.lines.filter((line) => line.type === type).length, 0);
}

/** Render unified-diff hunks with @@ range headers, +/- coloring, and "⋯ N lines hidden"
 *  separators between non-adjacent hunks (so far-apart edits show the skip explicitly). */
function renderDiffHunks(container: HTMLElement, hunks: DiffHunk[]): void {
  const wrap = container.createDiv({ cls: "chatobby-diff" });
  hunks.forEach((hunk, index) => {
    if (index > 0) {
      const prev = hunks[index - 1]!;
      const skipped = hunk.oldStart - (prev.oldStart + prev.oldCount);
      if (skipped > 0) {
        wrap.createDiv({ cls: "chatobby-diff__skip", text: `⋯ ${skipped} line${skipped === 1 ? "" : "s"} hidden` });
      }
    }
    const hunkEl = wrap.createDiv({ cls: "chatobby-diff__hunk" });
    hunkEl.createDiv({ cls: "chatobby-diff__header", text: `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@` });
    for (const line of hunk.lines) {
      const sign = line.type === "add" ? "+" : line.type === "del" ? "−" : " ";
      const cls = `chatobby-diff__line is-${line.type}`;
      hunkEl.createDiv({ cls, text: `${sign} ${line.text}` });
    }
  });
}

// ── helpers ──────────────────────────────────────────────────────────

function safeParseObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isTextContent(value: unknown): value is { type: "text"; text: string } {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === "text" && typeof (value as { text?: unknown }).text === "string");
}

function isImageContent(value: unknown): value is ImageContent {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === "image" && typeof (value as { data?: unknown }).data === "string");
}

function imageSource(image: ImageContent): string {
  if (image.data.startsWith("data:")) return image.data;
  return `data:${image.mimeType || "image/png"};base64,${image.data}`;
}

function truncateLines(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  if (lines.length <= TOOL_RESULT_TRUNCATE_LINES) return text;
  const hidden = lines.length - TOOL_RESULT_TRUNCATE_LINES;
  return `${lines.slice(0, TOOL_RESULT_TRUNCATE_LINES).join("\n")}\n… ${hidden} more line${hidden === 1 ? "" : "s"} (copied in full)`;
}

function stringField(data: Record<string, unknown>, fields: readonly string[]): string {
  for (const field of fields) {
    const value = data[field];
    if (typeof value === "string") return value;
  }
  return "";
}

function lineCount(value: string): number {
  return value ? value.split("\n").length : 0;
}

function compactStats(stats: ToolChangeStats): ToolChangeStats | null {
  return stats.additions > 0 || stats.deletions > 0 ? stats : null;
}
