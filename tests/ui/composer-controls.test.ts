import { describe, expect, it, vi } from "vitest";
import type { FrontendComposerViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { ComposerControls, type ComposerControlsHost } from "../../src/ui/composer/composer-controls";

function makeHost(overrides: Partial<ComposerControlsHost> = {}): ComposerControlsHost {
  return {
    getViewModel: () => composerModel(),
    applyControl: vi.fn(async () => {}),
    isBackendAvailable: () => true,
    ...overrides,
  };
}

function composerModel(provider = "deepseek", model = "deepseek/deepseek-chat"): FrontendComposerViewModel {
  return {
    canSubmit: true,
    controls: [
      {
        id: "provider",
        label: "Provider",
        value: provider,
        options: [
          { value: "anthropic", label: "Anthropic" },
          { value: "deepseek", label: "Deepseek" },
          { value: "openai", label: "Openai" },
        ],
      },
      {
        id: "model",
        label: "Model",
        value: model,
        options: [
          { value: "deepseek/deepseek-chat", label: "DeepSeek Chat", description: "deepseek" },
          { value: "openai/gpt-5", label: "GPT-5", description: "openai" },
          { value: "anthropic/claude-sonnet", label: "Claude Sonnet", description: "anthropic" },
        ],
      },
      {
        id: "effort",
        label: "Effort",
        value: "medium",
        options: ["Off", "Minimal", "Low", "Medium", "High", "X-High"].map((label) => ({
          value: label.toLocaleLowerCase().replace("-", ""),
          label,
        })),
      },
      {
        id: "permission",
        label: "Permission policy",
        value: "standard-safeguards",
        options: [
          { value: "", label: "Use project default", description: "Inherited policy: Standard safeguards" },
          { value: "standard-safeguards", label: "Standard safeguards" },
          { value: "read-only", label: "Read only" },
        ],
      },
    ],
  };
}

function renderControls(host: ComposerControlsHost): { controls: ComposerControls; root: HTMLElement } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const controls = new ComposerControls(host);
  controls.render(root);
  return { controls, root };
}

function control(root: HTMLElement, label: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`);
  if (!button) throw new Error(`Missing ${label} control`);
  return button;
}

describe("ComposerControls", () => {
  it("renders four compact runtime-projected picker triggers", () => {
    const { controls, root } = renderControls(makeHost());

    expect(control(root, "Permission policy").textContent).toContain("Standard safeguards");
    expect(control(root, "Provider").textContent).toContain("Deepseek");
    expect(control(root, "Model").textContent).toContain("DeepSeek Chat");
    expect(control(root, "Effort").textContent).toContain("Medium");
    expect(root.querySelectorAll("select")).toHaveLength(0);
    controls.destroy();
  });

  it("uses one searchable list and only shows runtime-projected policy descriptions", () => {
    const { controls, root } = renderControls(makeHost());
    const permissions = control(root, "Permission policy");
    permissions.click();

    expect(root.querySelectorAll(".chatobby-selection-menu__option")).toHaveLength(3);
    expect(permissions.getAttribute("aria-haspopup")).toBe("dialog");
    expect(root.querySelector("[role='dialog']")?.getAttribute("aria-label")).toBe("Permission policy");
    expect(root.querySelectorAll(".chatobby-selection-menu__option-description")).toHaveLength(1);
    expect(root.textContent).toContain("Inherited policy: Standard safeguards");
    controls.destroy();
  });

  it("dispatches one permission preference intent", async () => {
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl }));
    control(root, "Permission policy").click();
    const readOnly = Array.from(root.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent?.includes("Read only"));
    readOnly?.click();

    await vi.waitFor(() => expect(applyControl).toHaveBeenCalledWith("permission", "read-only"));
    controls.destroy();
  });

  it("filters projected models through the local provider selection", async () => {
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl }));
    control(root, "Provider").click();
    const openai = Array.from(root.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent?.includes("Openai"));
    openai?.click();
    await vi.waitFor(() => expect(controls.getProviderFilter()).toBe("openai"));
    await vi.waitFor(() => expect(applyControl).toHaveBeenCalledWith("model", "openai/gpt-5"));
    expect(control(root, "Model").textContent).toContain("GPT-5");

    control(root, "Model").click();
    expect(root.querySelectorAll(".chatobby-selection-menu__option")).toHaveLength(1);
    controls.destroy();
  });

  it("keeps the current model when choosing its existing provider", async () => {
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl }));
    control(root, "Provider").click();
    const deepseek = Array.from(root.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent?.includes("Deepseek"));
    deepseek?.click();

    await vi.waitFor(() => expect(controls.getProviderFilter()).toBe("deepseek"));
    expect(applyControl).not.toHaveBeenCalled();
    expect(control(root, "Model").textContent).toContain("DeepSeek Chat");
    controls.destroy();
  });

  it("keeps the selected provider across runtime refreshes", async () => {
    const { controls, root } = renderControls(makeHost());
    control(root, "Provider").click();
    const openai = Array.from(root.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent?.includes("Openai"));
    openai?.click();
    await vi.waitFor(() => expect(controls.getProviderFilter()).toBe("openai"));

    controls.refresh();

    expect(controls.getProviderFilter()).toBe("openai");
    expect(control(root, "Provider").textContent).toContain("Openai");
    controls.destroy();
  });

  it("renders providers in the authoritative runtime order", () => {
    const { controls, root } = renderControls(makeHost());
    control(root, "Provider").click();

    expect(Array.from(root.querySelectorAll(".chatobby-selection-menu__option-name")).map((option) => option.textContent))
      .toEqual(["Anthropic", "Deepseek", "Openai"]);
    controls.destroy();
  });

  it("opens with the provider and model selected by the runtime", () => {
    const { controls, root } = renderControls(makeHost({
      getViewModel: () => composerModel("openai", "openai/gpt-5"),
    }));

    expect(control(root, "Provider").textContent).toContain("Openai");
    expect(control(root, "Model").textContent).toContain("GPT-5");
    controls.destroy();
  });

  it("dispatches one effort preference intent", async () => {
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl }));
    control(root, "Effort").click();
    const high = Array.from(root.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent === "High");
    high?.click();

    await vi.waitFor(() => expect(applyControl).toHaveBeenCalledWith("effort", "high"));
    controls.destroy();
  });
});
