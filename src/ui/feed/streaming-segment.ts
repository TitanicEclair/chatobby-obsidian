import {
  STREAM_TEXT_DEBOUNCE_MS,
  STREAM_THINKING_DEBOUNCE_MS,
  STREAM_TOOLCALL_DEBOUNCE_MS,
} from "../shared/constants";

export type SegmentType = "thinking" | "text" | "toolcall";

export interface ContentSegment {
  contentIndex: number;
  type: SegmentType;
  element: HTMLElement;
  isFrozen: boolean;
  debounceTimer: number | null;
  debounceMs: number;
  buffer: unknown;
}

export function createSegment(contentIndex: number, type: SegmentType): ContentSegment {
  return {
    contentIndex,
    type,
    element: createDiv(),
    isFrozen: false,
    debounceTimer: null,
    debounceMs: debounceMsForType(type),
    buffer: null,
  };
}

export function updateSegment(segment: ContentSegment, content: unknown): void {
  if (segment.isFrozen) return;
  segment.buffer = content;
  if (segment.debounceTimer) segment.element.win.clearTimeout(segment.debounceTimer);
  segment.debounceTimer = segment.element.win.setTimeout(() => {
    segment.element.textContent = stringifySegmentContent(segment.buffer);
    segment.debounceTimer = null;
  }, segment.debounceMs);
}

export function freezeSegment(segment: ContentSegment): void {
  if (segment.debounceTimer) segment.element.win.clearTimeout(segment.debounceTimer);
  segment.element.textContent = stringifySegmentContent(segment.buffer);
  segment.debounceTimer = null;
  segment.isFrozen = true;
}

function debounceMsForType(type: SegmentType): number {
  if (type === "thinking") return STREAM_THINKING_DEBOUNCE_MS;
  if (type === "toolcall") return STREAM_TOOLCALL_DEBOUNCE_MS;
  return STREAM_TEXT_DEBOUNCE_MS;
}

function stringifySegmentContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content === null || content === undefined) return "";
  return JSON.stringify(content);
}
