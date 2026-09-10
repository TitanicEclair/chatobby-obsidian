// ComposerControls — compact, native rendering of the runtime-owned control model.

import { setIcon } from "obsidian";
import type { WsProviderInfo } from "../../types";
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
  refreshModelCatalogue?(): Promise<WsProviderInfo[]>;
}

/** Reconcile only the connection that initiated discovery, before exposing its status. */
export async function refreshComposerModelCatalogue<T extends { isConnected: boolean; getProviders(): Promise<WsProviderInfo[]> }>(
  getTransport: () => T | null,
  synchronize: (transport: T) => Promise<void>,
): Promise<WsProviderInfo[]> {
  const transport = getTransport();
  if (!transport?.isConnected) return [];
  const providers = await transport.getProviders();
  if (transport !== getTransport()) return [];
  await synchronize(transport);
  return transport === getTransport() ? providers : [];
}

/** Native buttons and searchable menus; all option semantics come from the runtime. */
export class ComposerControls extends ChatobbyComponent {
  private readonly buttons = new Map<PickerKind, HTMLButtonElement>();
  private picker: SelectionMenu | null = null;
  private activePickerKind: PickerKind | null = null;
  private activePickerAnchor: HTMLButtonElement | null = null;
  private providerFilter = "";
  private runtimeProvider: string | undefined;
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
    for (const id of ["provider", "model", "effort"] as const) {
      const control = findControl(model, id);
      if (!control) continue;
      const button = this.buildPickerButton(container, control);
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
    const visibleControls = model.controls.filter(control => control.id !== "permission" && control.id !== "network");
    if (this.buttons.size !== visibleControls.length || visibleControls.some((control) => !this.buttons.has(control.id))) {
      this.closePicker(false);
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
    this.activePickerAnchor = anchor;
    anchor.setAttr("aria-expanded", "true");
    anchor.setAttr("aria-controls", picker.id);
    picker.render(this.container!);
    if ((kind === "provider" || kind === "model") && this.host.refreshModelCatalogue) {
      void this.host.refreshModelCatalogue().then((providers) => {
        if (this.picker !== picker) return;
        this.refresh();
        const selected = providers.filter((provider) => kind === "provider" || provider.id === this.providerFilter);
        const messages = selected.flatMap((provider) => {
          const discovery = provider.modelDiscovery;
          if (!discovery) return [];
          const error = discovery.error ? `${discovery.error} ${discovery.usingCachedModels ? "Keeping the last account model list." : "Showing bundled choices until access can be checked."}` : "";
          const count = discovery.unavailableModels.length;
          const excluded = count ? `${count} account ${count === 1 ? "model needs" : "models need"} attention. See this connection in Settings for details.` : "";
          return [error, excluded].filter(Boolean);
        });
        picker.setNotice(messages.join("\n"));
      }).catch(() => {
        if (this.picker === picker) picker.setNotice("Could not refresh model choices. Check the runtime connection in Settings.");
      });
    }
  }

  private closePicker(restoreFocus: boolean): void {
    const anchor = this.activePickerAnchor;
    this.picker?.destroy();
    this.picker = null;
    this.activePickerKind = null;
    this.activePickerAnchor = null;
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
      description: control.id === "model" ? option.disabledReason : option.description,
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
      button.title = option?.disabledReason
        ? `${control.label}: ${option.label}. ${option.disabledReason}`
        : `${control.label}: ${option?.label ?? "Not selected"}`;
      button.setAttr("aria-label", button.title);
    }
  }

  private resolveProviderFilter(model: FrontendComposerViewModel): string {
    const provider = findControl(model, "provider");
    if (!provider) return "";
    // Keep a pending picker choice during unrelated refreshes, but follow an
    // authoritative provider change from another view or restored session.
    if (provider.value !== this.runtimeProvider) {
      this.runtimeProvider = provider.value;
      return provider.value || provider.options[0]?.value || "";
    }
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
    const icon = button.createSpan({ cls: "chatobby-control-button__icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, controlIcon(control.id));
    button.createSpan({ cls: "chatobby-control-button__label", text: control.label });
    setIcon(button.createSpan({ cls: "chatobby-control-button__chevron", attr: { "aria-hidden": "true" } }), "chevron-down");
    return button;
  }

}

function controlIcon(id: PickerKind): string {
  switch (id) {
    case "permission": return "shield-check";
    case "network": return "globe";
    case "provider": return "server";
    case "model": return "bot";
    case "effort": return "gauge";
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
