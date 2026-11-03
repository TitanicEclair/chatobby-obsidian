/** Small presentation helpers shared by Project leaves; no domain state. */
export function choiceSelect(
  parent: HTMLElement,
  options: readonly { readonly value: string; readonly label: string }[],
  selected: string,
  label: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const select = parent.createEl("select", { cls: "chatobby-projects__select dropdown" });
  select.setAttr("aria-label", label);
  for (const option of options) {
    const element = select.createEl("option", { value: option.value, text: option.label });
    element.selected = option.value === selected;
  }
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

export function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
