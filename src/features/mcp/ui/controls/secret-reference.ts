import { SecretComponent, type App } from "obsidian";
import { createPageActionRow } from "../../../../ui/shared/page-shell";
import { action } from "./form-fields";

interface SecretReferenceField {
  readonly wrapper: HTMLElement;
  readonly select: HTMLSelectElement;
  onSecretsChanged(listener: () => void): void;
}

export function secretReferenceField(
  app: App,
  parent: HTMLElement,
  label: string,
  key: string,
  initialReference: string,
): SecretReferenceField {
  const wrapper = parent.createDiv({ cls: "chatobby-mcp__secret-field" });
  const field = wrapper.createEl("label", { cls: "chatobby-mcp__field" });
  field.createSpan({ text: label });
  const select = field.createEl("select", {
    attr: {
      "aria-label": label,
      "data-page-state-key": key,
    },
  });
  const listeners = new Set<() => void>();
  const refresh = (preferredReference = select.value): void => {
    const references = app.secretStorage
      .listSecrets()
      .sort((left, right) => left.localeCompare(right));
    select.empty();
    const empty = select.createEl("option", { text: "Choose a saved token…" });
    empty.value = "";
    for (const reference of references) {
      const option = select.createEl("option", { text: reference });
      option.value = reference;
    }
    select.value = references.includes(preferredReference)
      ? preferredReference
      : references.includes(initialReference)
        ? initialReference
        : "";
    for (const listener of listeners) listener();
  };
  refresh(initialReference);

  const management = wrapper.createDiv({
    cls: "chatobby-mcp__secret-management",
  });
  management.createSpan({
    cls: "chatobby-mcp__secret-help",
    text: "Need another token? Add or manage it in Obsidian, then refresh this list.",
  });
  const controls = createPageActionRow(management);
  new SecretComponent(app, controls)
    .setValue("")
    .onChange((reference) => refresh(reference || ""));
  action(controls, "Refresh saved tokens", () => refresh());

  return {
    wrapper,
    select,
    onSecretsChanged: (listener) => {
      listeners.add(listener);
    },
  };
}
