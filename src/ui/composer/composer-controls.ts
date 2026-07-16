// ComposerControls — compact, native rendering of the runtime-owned control model.

import { setIcon } from "obsidian";
import type {
  FrontendChoiceControl,
  FrontendComposerViewModel,
} from "../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../shared/component";
import { SelectionMenu, type SelectionMenuItem } from "./selection-menu";

type PickerKind = FrontendChoiceControl["id"];

export interface ComposerControlsHost {
  getViewModel(): FrontendComposerViewModel | null;
  applyControl(id: Exclude<PickerKind, "provider">, value: string): Promise<void>;
  isBackendAvailable(): boolean;
}

/** Native buttons and searchable menus; all option semantics come from the runtime. */
export class ComposerControls extends ChatobbyComponent {
  private readonly buttons = new Map<PickerKind, HTMLButtonElement>();
  private picker: SelectionMenu | null = null;
  private activePickerKind: PickerKind | null = null;
  private providerFilter = "";
  private selectedModel = "";

  constructor(private readonly host: ComposerControlsHost) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-composer-controls";
  }

  protected onRender(container: HTMLElement): void {
    const model = this.host.getViewModel();
    if (!this.host.isBackendAvailable() || !model) {
      container.addClass("is-hidden");
      return;
    }
    this.providerFilter = this.resolveProviderFilter(model);
    this.selectedModel = this.resolveModelSelection(model);
    for (const id of ["permission", "provider", "model", "effort"] as const) {
      const control = findControl(model, id);
      if (!control) continue;
      const button = this.buildPickerButton(container, control, id === "permission" ? "shield-check" : undefined);
      button.addEventListener("click", () => this.togglePicker(id));
      this.buttons.set(id, button);
    }
    this.refreshControlLabels();
  }

  /** Re-render labels and open menu from the latest runtime projection. */
  refresh(): void {
    if (!this.isMounted) return;
    const model = this.host.getViewModel();
    if (!this.host.isBackendAvailable() || !model) {
      this.closePicker(false);
      this.container?.addClass("is-hidden");
      return;
    }
    this.container?.removeClass("is-hidden");
    const expectedControls = model.controls.length;
    if (this.buttons.size !== expectedControls) {
      this.buttons.clear();
      this.container?.empty();
      this.onRender(this.container!);
      return;
    }
    this.providerFilter = this.resolveProviderFilter(model);
    this.selectedModel = this.resolveModelSelection(model);
    this.refreshControlLabels();
    this.refreshOpenPicker();
  }

  getProviderFilter(): string | null {
    return this.providerFilter || null;
  }

  override destroy(): void {
    this.closePicker(false);
    this.buttons.clear();
    super.destroy();
  }

  private togglePicker(kind: PickerKind): void {
    if (this.activePickerKind === kind) {
      this.closePicker(true);
      return;
    }
    this.closePicker(false);
    this.openPicker(kind);
  }

  private openPicker(kind: PickerKind): void {
    const anchor = this.buttons.get(kind);
    const control = this.control(kind);
    if (!anchor || !control) return;
    let picker: SelectionMenu;
    picker = new SelectionMenu({
      anchor,
      title: control.label,
      searchPlaceholder: `Search ${control.label.toLocaleLowerCase()}…`,
      items: this.itemsFor(control),
      selectedValue: kind === "provider" ? this.providerFilter : kind === "model" ? this.selectedModel : control.value,
      onChoose: async (item) => {
        if (kind === "provider") {
          const previousProvider = this.providerFilter;
          const previousModel = this.selectedModel;
          this.providerFilter = item.value;
          const modelControl = this.control("model");
          const nextModel = modelControl?.options.find((option) =>
            option.description === item.value && option.disabledReason === undefined);
          this.selectedModel = nextModel?.value ?? "";
          this.refreshControlLabels();
          if (nextModel && modelControl?.value !== nextModel.value) {
            try {
              await this.host.applyControl("model", nextModel.value);
            } catch (error) {
              this.providerFilter = previousProvider;
              this.selectedModel = previousModel;
              this.refreshControlLabels();
              throw error;
            }
          }
          return;
        }
        const previousModel = this.selectedModel;
        if (kind === "model") this.selectedModel = item.value;
        try {
          await this.host.applyControl(kind, item.value);
        } catch (error) {
          if (kind === "model") {
            this.selectedModel = previousModel;
            this.refreshControlLabels();
          }
          throw error;
        }
      },
      onClose: (restoreFocus) => {
        if (this.picker === picker) this.closePicker(restoreFocus);
      },
    });
    this.picker = picker;
    this.activePickerKind = kind;
    anchor.setAttr("aria-expanded", "true");
    anchor.setAttr("aria-controls", picker.id);
    picker.render(this.container!);
  }

  private closePicker(restoreFocus: boolean): void {
    const anchor = this.activePickerKind ? this.buttons.get(this.activePickerKind) : undefined;
    this.picker?.destroy();
    this.picker = null;
    this.activePickerKind = null;
    anchor?.setAttr("aria-expanded", "false");
    anchor?.removeAttribute("aria-controls");
    if (restoreFocus) anchor?.focus();
  }

  private refreshOpenPicker(): void {
    if (!this.picker || !this.activePickerKind) return;
    const control = this.control(this.activePickerKind);
    if (!control) {
      this.closePicker(false);
      return;
    }
    this.picker.setItems(
      this.itemsFor(control),
      this.activePickerKind === "provider"
        ? this.providerFilter
        : this.activePickerKind === "model"
          ? this.selectedModel
          : control.value,
    );
  }

  private itemsFor(control: FrontendChoiceControl): SelectionMenuItem[] {
    const options = control.id === "model" && this.providerFilter
      ? control.options.filter((option) => option.description === this.providerFilter)
      : control.options;
    return options.map((option) => ({
      value: option.value,
      label: option.label,
      description: control.id === "model" ? undefined : option.description,
      disabled: option.disabledReason !== undefined,
    }));
  }

  private refreshControlLabels(): void {
    for (const [id, button] of this.buttons) {
      const control = this.control(id);
      if (!control) continue;
      const value = id === "provider" ? this.providerFilter : id === "model" ? this.selectedModel : control.value;
      const option = control.options.find((candidate) => candidate.value === value);
      setButtonLabel(button, option?.label ?? control.label);
      button.title = `${control.label}: ${option?.label ?? "Not selected"}`;
    }
  }

  private resolveProviderFilter(model: FrontendComposerViewModel): string {
    const provider = findControl(model, "provider");
    if (!provider) return "";
    if (provider.options.some((option) => option.value === this.providerFilter)) return this.providerFilter;
    return provider.value || provider.options[0]?.value || "";
  }

  private resolveModelSelection(model: FrontendComposerViewModel): string {
    const control = findControl(model, "model");
    if (!control) return "";
    const available = control.options.filter((option) => option.description === this.providerFilter);
    if (available.some((option) => option.value === control.value)) return control.value;
    if (available.some((option) => option.value === this.selectedModel)) return this.selectedModel;
    return available.find((option) => option.disabledReason === undefined)?.value ?? "";
  }

  private control(id: PickerKind): FrontendChoiceControl | null {
    const model = this.host.getViewModel();
    return model ? findControl(model, id) ?? null : null;
  }

  private buildPickerButton(
    container: HTMLElement,
    control: FrontendChoiceControl,
    leadingIcon?: string,
  ): HTMLButtonElement {
    const button = container.createEl("button", {
      cls: `chatobby-control chatobby-control-button chatobby-control--${control.id}`,
      attr: {
        type: "button",
        "aria-label": control.label,
        "aria-haspopup": "dialog",
        "aria-expanded": "false",
        title: control.label,
      },
    });
    if (leadingIcon) setIcon(button.createSpan({ cls: "chatobby-control-button__leading" }), leadingIcon);
    button.createSpan({ cls: "chatobby-control-button__label", text: control.label });
    setIcon(button.createSpan({ cls: "chatobby-control-button__chevron", attr: { "aria-hidden": "true" } }), "chevron-down");
    return button;
  }
}

function findControl(
  model: FrontendComposerViewModel,
  id: PickerKind,
): FrontendChoiceControl | undefined {
  return model.controls.find((control) => control.id === id);
}

function setButtonLabel(button: HTMLButtonElement, label: string): void {
  const element = button.querySelector(".chatobby-control-button__label");
  if (element) element.textContent = label;
}
