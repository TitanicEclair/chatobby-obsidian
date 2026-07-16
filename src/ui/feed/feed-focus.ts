const TEXT_ENTRY_SELECTOR = "input, select, textarea, [contenteditable='true'], [role='textbox']";
const FOCUS_STEALING_FEED_CONTROL_SELECTOR = "button, a[href], summary, [role='button'], [role='menuitem']";

/** Keep mouse-operated feed controls from ejecting a keyboard user from the composer. */
export function preserveComposerFocusForFeedControl(event: PointerEvent): void {
  const active = document.activeElement;
  const target = event.target;
  if (!(active instanceof HTMLTextAreaElement) || !active.hasClass("chatobby-input")) return;
  if (!(target instanceof Element) || target.closest(TEXT_ENTRY_SELECTOR)) return;
  if (target.closest(FOCUS_STEALING_FEED_CONTROL_SELECTOR)) event.preventDefault();
}
