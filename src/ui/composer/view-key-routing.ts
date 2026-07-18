function ownsTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable
    || target.closest("[contenteditable='true'], [role='textbox']") !== null;
}

/** Route ordinary typing on a chat surface into its visible composer. */
export function routePrintableKeyToComposer(event: KeyboardEvent, input: HTMLTextAreaElement): boolean {
  if (
    event.defaultPrevented
    || event.isComposing
    || event.ctrlKey
    || event.metaKey
    || event.altKey
    || event.key.length !== 1
    || input.disabled
    || input.readOnly
    || ownsTextInput(event.target)
  ) return false;

  // Preserve native Space activation when a keyboard user has focused a control.
  if (
    event.key === " "
    && event.target instanceof Element
    && event.target.closest("button, a, summary, [role='button'], [role='menuitem']")
  ) return false;

  input.focus({ preventScroll: true });
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText(event.key, start, end, "end");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  event.preventDefault();
  return true;
}
