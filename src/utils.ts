// Chatobby utility functions — shared helpers, no side effects.

import { Notice } from "obsidian";
import { NOTICE_DURATION_MS } from "./ui/shared/constants";

/**
 * Extract a human-readable error message from any thrown value.
 * Handles Error objects, strings, and unknown types.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

/**
 * Show a toast notification to the user via Obsidian's Notice API.
 */
export function notifyUser(message: string, duration?: number): void {
  new Notice(message, duration ?? NOTICE_DURATION_MS);
}
