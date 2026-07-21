import { TFile, TFolder } from "obsidian";

/**
 * Obsidian files normally narrow through their runtime constructors. The
 * structural fallback keeps bridge adapters usable with API-compatible vault
 * implementations and test doubles where those constructors are unavailable.
 */
export function isTFile(value: unknown): value is TFile {
  if (typeof TFile === "function" && value instanceof TFile) return true;
  if (!isRecord(value)) return false;
  return typeof value.path === "string"
    && typeof value.name === "string"
    && typeof value.basename === "string"
    && typeof value.extension === "string"
    && isRecord(value.stat);
}

/** See {@link isTFile}. */
export function isTFolder(value: unknown): value is TFolder {
  if (typeof TFolder === "function" && value instanceof TFolder) return true;
  if (!isRecord(value)) return false;
  return typeof value.path === "string"
    && typeof value.name === "string"
    && Array.isArray(value.children);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
