import { setIcon } from "obsidian";

export function inputField(
  parent: HTMLElement,
  label: string,
  key: string,
  placeholder: string,
  help?: string,
): HTMLInputElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  const input = wrapper.createEl("input", {
    attr: { placeholder, "data-page-state-key": key },
  });
  if (help) wrapper.createSpan({ cls: "chatobby-mcp__field-help", text: help });
  return input;
}

export function textAreaField(
  parent: HTMLElement,
  label: string,
  key: string,
  help?: string,
): HTMLTextAreaElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  const textarea = wrapper.createEl("textarea", {
    attr: { rows: "3", "data-page-state-key": key },
  });
  if (help) wrapper.createSpan({ cls: "chatobby-mcp__field-help", text: help });
  return textarea;
}

export function selectField(
  parent: HTMLElement,
  label: string,
  key: string,
  options: readonly (readonly [string, string])[],
  help?: string,
): HTMLSelectElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  const select = wrapper.createEl("select", {
    attr: { "data-page-state-key": key },
  });
  selectOptions(select, options);
  if (help) wrapper.createSpan({ cls: "chatobby-mcp__field-help", text: help });
  return select;
}

export function connectionChoice(
  parent: HTMLElement,
  iconName: string,
  title: string,
  description: string,
  onChoose: () => void,
): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "chatobby-mcp__connection-choice",
    attr: { type: "button", "aria-pressed": "false" },
  });
  const icon = button.createSpan({
    cls: "chatobby-mcp__connection-choice-icon",
    attr: { "aria-hidden": "true" },
  });
  setIcon(icon, iconName);
  const copy = button.createSpan({
    cls: "chatobby-mcp__connection-choice-copy",
  });
  copy.createSpan({
    cls: "chatobby-mcp__connection-choice-title",
    text: title,
  });
  copy.createSpan({
    cls: "chatobby-mcp__connection-choice-description",
    text: description,
  });
  button.addEventListener("click", onChoose);
  return button;
}

export function selectOptions(
  select: HTMLSelectElement,
  options: readonly (readonly [string, string])[],
): void {
  for (const [value, text] of options) {
    const option = select.createEl("option", { text });
    option.value = value;
  }
}

export function action(
  parent: HTMLElement,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = parent.createEl("button", {
    text: label,
    attr: { type: "button" },
  });
  button.addEventListener("click", onClick);
  return button;
}
