import type { ComposerKeybindings } from "../../types";

export type ComposerKeybindingAction = keyof ComposerKeybindings;

interface ParsedComposerKeybinding {
  key: string;
  mod: boolean;
  alt: boolean;
  shift: boolean;
}

/** Match a persisted Chatobby composer shortcut against one keyboard event. */
export function matchesComposerKeybinding(event: KeyboardEvent, binding: string): boolean {
  const parsed = parseComposerKeybinding(binding);
  if (!parsed) return false;
  return normalizedEventKey(event.key) === parsed.key
    && (event.ctrlKey || event.metaKey) === parsed.mod
    && event.altKey === parsed.alt
    && event.shiftKey === parsed.shift;
}

/** Capture a platform-neutral composer shortcut from a settings input. */
export function composerKeybindingFromEvent(event: KeyboardEvent): string | null {
  const key = normalizedEventKey(event.key);
  if (key === "Control" || key === "Meta" || key === "Alt" || key === "Shift") return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

export function isValidComposerKeybinding(binding: string): boolean {
  return parseComposerKeybinding(binding) !== null;
}

export function composerKeybindingLabel(binding: string): string {
  return binding.replace(/^Mod\+/u, `${process.platform === "darwin" ? "Cmd" : "Ctrl"}+`);
}

function parseComposerKeybinding(binding: string): ParsedComposerKeybinding | null {
  const parts = binding.split("+").map((part) => part.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) return null;
  const modifiers = new Set(parts);
  if ([...modifiers].some((modifier) => modifier !== "Mod" && modifier !== "Alt" && modifier !== "Shift")) {
    return null;
  }
  return {
    key: normalizedEventKey(key),
    mod: modifiers.has("Mod"),
    alt: modifiers.has("Alt"),
    shift: modifiers.has("Shift"),
  };
}

function normalizedEventKey(key: string): string {
  if (key === " ") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
}
