import type { ChatobbyComponent } from "../../../src/ui/shared/component";

export function mount(component: ChatobbyComponent): HTMLElement {
  const root = document.body.createDiv();
  component.render(root);
  const mounted = root.firstElementChild;
  if (!(mounted instanceof HTMLElement)) throw new Error("component did not render");
  return mounted;
}
