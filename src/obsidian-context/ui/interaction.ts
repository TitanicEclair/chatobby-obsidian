import { BridgeError } from "../../obsidian-bridge/types";
import type { ObsidianUiInteractInput } from "./types";

function setElementValue(element: Element, value: string): void {
  const tag = element.tagName.toLowerCase();
  if (tag === "input") {
    const input = element as HTMLInputElement;
    if (["button", "submit", "reset", "checkbox", "radio", "file"].includes(input.type)) {
      throw new BridgeError("INVALID_INPUT", `set_value is not supported for input type '${input.type}'`);
    }
    input.value = value;
  } else if (tag === "textarea") {
    (element as HTMLTextAreaElement).value = value;
  } else if (tag === "select") {
    (element as HTMLSelectElement).value = value;
  } else if (element.getAttribute("contenteditable") === "true") {
    element.textContent = value;
  } else {
    throw new BridgeError("INVALID_INPUT", "set_value requires an input, textarea, select, or contenteditable element");
  }
  const EventConstructor = element.ownerDocument.defaultView?.Event ?? Event;
  element.dispatchEvent(new EventConstructor("input", { bubbles: true }));
  element.dispatchEvent(new EventConstructor("change", { bubbles: true }));
}

export function performInteraction(element: Element, input: ObsidianUiInteractInput): void {
  if (input.action === "click") {
    const clickable = element as Element & { click?: () => void };
    if (clickable.click) clickable.click();
    else {
      const MouseEventConstructor = element.ownerDocument.defaultView?.MouseEvent ?? MouseEvent;
      element.dispatchEvent(new MouseEventConstructor("click", { bubbles: true, cancelable: true }));
    }
    return;
  }
  if (input.action === "focus") {
    const focusable = element as Element & { focus?: () => void };
    if (!focusable.focus) throw new BridgeError("INVALID_INPUT", "The referenced element cannot receive focus");
    focusable.focus();
    return;
  }
  if (input.action === "set_expanded") {
    if (input.expanded === undefined) {
      throw new BridgeError("INVALID_INPUT", "set_expanded requires the 'expanded' boolean");
    }
    if (element.tagName.toLowerCase() === "details") {
      (element as HTMLDetailsElement).open = input.expanded;
    } else if (element.hasAttribute("aria-expanded")) {
      element.setAttribute("aria-expanded", String(input.expanded));
    } else {
      throw new BridgeError("INVALID_INPUT", "set_expanded requires a details or aria-expanded element");
    }
    const EventConstructor = element.ownerDocument.defaultView?.Event ?? Event;
    element.dispatchEvent(new EventConstructor("toggle", { bubbles: true }));
    return;
  }
  if (input.value === undefined) throw new BridgeError("INVALID_INPUT", "set_value requires the 'value' string");
  setElementValue(element, input.value);
}
