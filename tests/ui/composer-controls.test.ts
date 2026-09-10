import { afterEach, describe, expect, it, vi } from "vitest";
import type { FrontendComposerViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { ComposerControls, refreshComposerModelCatalogue, type ComposerControlsHost } from "../../src/ui/composer/composer-controls";
import type { WsProviderInfo } from "../../src/types";

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
        value: "workspace",
        options: [
          { value: "read-only", label: "Read-only" },
          { value: "workspace", label: "Workspace" },
          { value: "full", label: "Full", description: "Unsandboxed" },
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
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label^='${label}:']`);
  if (!button) throw new Error(`Missing ${label} control`);
  return button;
}

afterEach(() => document.body.replaceChildren());

describe("ComposerControls", () => {
  it("drops discovery from a replaced connection before frontend synchronization", async () => {
    let finish!: (providers: WsProviderInfo[]) => void;
    const first = { isConnected: true, getProviders: () => new Promise<WsProviderInfo[]>((resolve) => { finish = resolve; }) };
    let current = first;
    const synchronize = vi.fn(async () => {});
    const pending = refreshComposerModelCatalogue(() => current, synchronize);
    current = { isConnected: true, getProviders: async () => [] };
    finish([{ id: "old-account", name: "Old account", configured: true, modelCount: 1, availableModelCount: 1 }]);
    expect(await pending).toEqual([]);
    expect(synchronize).not.toHaveBeenCalled();
  });

  it("refreshes an open model menu while preserving search, choices and discovery reasons", async () => {
    let finish!: (providers: WsProviderInfo[]) => void;
    const applyControl = vi.fn(async () => {});
    const refreshModelCatalogue = vi.fn(() => new Promise<WsProviderInfo[]>((resolve) => { finish = resolve; }));
    const { controls, root } = renderControls(makeHost({ applyControl, refreshModelCatalogue }));
    control(root, "Model").click();
    const input = document.querySelector<HTMLInputElement>(".chatobby-selection-menu__search")!;
    input.value = "Chat";
    input.dispatchEvent(new Event("input"));
    finish([{ id: "deepseek", name: "DeepSeek", configured: true, modelCount: 2, availableModelCount: 1,
      modelDiscovery: { checkedAt: 1, error: "Model discovery returned HTTP 503.", usingCachedModels: true,
        unavailableModels: [{ id: "restricted-model", reason: "Disabled by account policy." }] } }]);
    await vi.waitFor(() => expect(document.body.textContent).toContain("HTTP 503"));
    expect(input.value).toBe("Chat");
    expect(document.body.textContent).toContain("Keeping the last account model list");
    expect(document.body.textContent).toContain("See this connection in Settings");
    expect(document.querySelectorAll(".chatobby-selection-menu__option")).toHaveLength(1);
    expect(document.querySelector<HTMLButtonElement>(".chatobby-selection-menu__option")?.disabled).toBe(false);
    expect(applyControl).not.toHaveBeenCalled();
    controls.destroy();
  });

  it("ignores a late catalogue failure after switching to another picker", async () => {
    let reject!: (error: Error) => void;
    const refreshModelCatalogue = vi.fn(() => new Promise<WsProviderInfo[]>((_resolve, onReject) => { reject = onReject; }));
    const { controls, root } = renderControls(makeHost({ refreshModelCatalogue }));
    control(root, "Model").click();
    control(root, "Effort").click();
    reject(new Error("Disconnected"));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector("[role='dialog']")?.getAttribute("aria-label")).toBe("Effort");
    expect(document.body.textContent).not.toContain("Could not refresh");
    expect(document.querySelectorAll(".chatobby-selection-menu__option")).toHaveLength(6);
    controls.destroy();
  });

  it("keeps model choices usable when the runtime cannot refresh", async () => {
    const { controls, root } = renderControls(makeHost({ refreshModelCatalogue: async () => { throw new Error("Disconnected"); } }));
    control(root, "Model").click();
    await vi.waitFor(() => expect(document.body.textContent).toContain("Could not refresh model choices"));
    expect(document.querySelector<HTMLButtonElement>(".chatobby-selection-menu__option")?.disabled).toBe(false);
    controls.destroy();
  });

  it("hides legacy permission and network controls without rebuilding model controls on refresh", () => {
    const base = composerModel();
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl, getViewModel: () => ({ ...base, controls: [...base.controls, {
      id: "network", label: "Agent network", value: "on", options: [{ value: "on", label: "Network On" }, { value: "off", label: "Network Off" }],
    }] }) }));
    const modelButton = control(root, "Model");
    controls.refresh(); controls.refresh();
    expect(root.querySelector(".chatobby-control--permission")).toBeNull();
    expect(root.querySelector(".chatobby-control--network")).toBeNull();
    expect(control(root, "Model")).toBe(modelButton);
    expect(applyControl).not.toHaveBeenCalled();
    controls.destroy();
  });
  it("renders semantic icons without relegating controls to overflow", () => {
    const { controls, root } = renderControls(makeHost());

    expect(root.querySelector(".chatobby-control--permission")).toBeNull();
    expect(root.querySelector(".chatobby-control--model .chatobby-control-button__icon")?.getAttribute("data-icon")).toBe("bot");
    expect(root.querySelector(".chatobby-control-overflow")).toBeNull();
    controls.destroy();
  });
  it("renders the three model and effort picker triggers", () => {
    const { controls, root } = renderControls(makeHost());

    expect(root.querySelectorAll(".chatobby-control-button")).toHaveLength(3);
    expect(control(root, "Provider").textContent).toContain("Deepseek");
    expect(control(root, "Model").textContent).toContain("DeepSeek Chat");
    expect(control(root, "Effort").textContent).toContain("Medium");
    expect(root.querySelectorAll("select")).toHaveLength(0);
    controls.destroy();
  });

  it("uses one searchable list for effort choices", () => {
    const { controls, root } = renderControls(makeHost());
    const permissions = control(root, "Effort");
    permissions.click();

    expect(document.querySelectorAll(".chatobby-selection-menu__option")).toHaveLength(6);
    expect(permissions.getAttribute("aria-haspopup")).toBe("dialog");
    expect(document.querySelector("[role='dialog']")?.getAttribute("aria-label")).toBe("Effort");
    controls.destroy();
  });

  it("dispatches one effort choice", async () => {
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl }));
    control(root, "Effort").click();
    const readOnly = Array.from(document.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent === "Low");
    readOnly?.click();

    await vi.waitFor(() => expect(applyControl).toHaveBeenCalledWith("effort", "low"));
    controls.destroy();
  });

  it("keeps the runtime effort and icon while a choice is pending or rejected", async () => {
    let reject!: (error: Error) => void;
    const applyControl = vi.fn(() => new Promise<void>((_resolve, onReject) => { reject = onReject; }));
    const { controls, root } = renderControls(makeHost({ applyControl }));
    const permission = control(root, "Effort");
    permission.click();
    const readOnly = Array.from(document.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent === "Low");
    readOnly?.click();
    await vi.waitFor(() => expect(applyControl).toHaveBeenCalledWith("effort", "low"));
    expect(permission.textContent).toContain("Medium");
    expect(permission.querySelector(".chatobby-control-button__icon")?.getAttribute("data-icon")).toBe("gauge");
    reject(new Error("Policy changed. Refresh and retry."));
    await vi.waitFor(() => expect(document.body.textContent).toContain("Could not apply this selection."));
    expect(permission.textContent).toContain("Medium");
    controls.destroy();
  });

  it("filters projected models through the local provider selection", async () => {
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl }));
    control(root, "Provider").click();
    const openai = Array.from(document.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent?.includes("Openai"));
    openai?.click();
    await vi.waitFor(() => expect(controls.getProviderFilter()).toBe("openai"));
    await vi.waitFor(() => expect(applyControl).toHaveBeenCalledWith("model", "openai/gpt-5"));
    expect(control(root, "Model").textContent).toContain("GPT-5");

    control(root, "Model").click();
    expect(document.querySelectorAll(".chatobby-selection-menu__option")).toHaveLength(1);
    controls.destroy();
  });

  it("keeps the current model when choosing its existing provider", async () => {
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl }));
    control(root, "Provider").click();
    const deepseek = Array.from(document.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
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
    const openai = Array.from(document.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent?.includes("Openai"));
    openai?.click();
    await vi.waitFor(() => expect(controls.getProviderFilter()).toBe("openai"));

    controls.refresh();

    expect(controls.getProviderFilter()).toBe("openai");
    expect(control(root, "Provider").textContent).toContain("Openai");
    controls.destroy();
  });

  it("follows a runtime provider change without sending another selection intent", () => {
    let model = composerModel();
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ getViewModel: () => model, applyControl }));
    control(root, "Model").click();

    model = composerModel("openai", "openai/gpt-5");
    controls.refresh();

    expect(controls.getProviderFilter()).toBe("openai");
    expect(control(root, "Provider").textContent).toContain("Openai");
    expect(control(root, "Model").textContent).toContain("GPT-5");
    expect(document.querySelector(".chatobby-selection-menu__option-name")?.textContent).toBe("GPT-5");
    expect(applyControl).not.toHaveBeenCalled();
    controls.destroy();
  });

  it("updates an open model picker from a live runtime catalogue projection", () => {
    let model = composerModel();
    const { controls, root } = renderControls(makeHost({ getViewModel: () => model }));
    control(root, "Model").click();
    expect(document.body.textContent).not.toContain("DeepSeek Reasoner");

    const modelControl = model.controls.find((candidate) => candidate.id === "model");
    if (!modelControl) throw new Error("Missing model control fixture");
    model = {
      ...model,
      controls: model.controls.map((candidate) => candidate.id === "model"
        ? {
            ...modelControl,
            options: [
              ...modelControl.options,
              { value: "deepseek/deepseek-reasoner", label: "DeepSeek Reasoner", description: "deepseek" },
            ],
          }
        : candidate),
    };

    controls.refresh();

    expect(document.body.textContent).toContain("DeepSeek Reasoner");
    expect(document.querySelectorAll(".chatobby-selection-menu__option")).toHaveLength(2);
    controls.destroy();
  });

  it("renders providers in the authoritative runtime order", () => {
    const { controls, root } = renderControls(makeHost());
    control(root, "Provider").click();

    expect(Array.from(document.querySelectorAll(".chatobby-selection-menu__option-name")).map((option) => option.textContent))
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

  it("keeps a live-retired current model visible and disabled without silently reselecting", () => {
    const applyControl = vi.fn(async () => {});
    let model = composerModel("openai", "openai/gpt-5");
    const { controls, root } = renderControls(makeHost({ getViewModel: () => model, applyControl }));
    const base = composerModel("openai", "openai/gpt-5");
    model = {
      ...base,
      controls: base.controls.map((candidate) => candidate.id === "model"
        ? {
            ...candidate,
            options: [
              {
                value: "openai/gpt-5",
                label: "GPT-5 (unavailable)",
                description: "openai",
                disabledReason: "Not available in the current model catalogue or provider configuration",
              },
              { value: "openai/gpt-5.1", label: "GPT-5.1", description: "openai" },
            ],
          }
        : candidate),
    };
    controls.refresh();

    expect(control(root, "Model").textContent).toContain("GPT-5 (unavailable)");
    expect(control(root, "Model").title).toContain("Not available in the current model catalogue");
    control(root, "Model").click();
    const options = Array.from(document.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"));
    expect(options.find((option) => option.textContent?.includes("GPT-5 (unavailable)"))?.disabled).toBe(true);
    expect(document.body.textContent).toContain("Not available in the current model catalogue");
    expect(options.find((option) => option.textContent?.includes("GPT-5.1"))?.disabled).toBe(false);
    expect(applyControl).not.toHaveBeenCalled();
    controls.destroy();
  });

  it("dispatches one effort preference intent", async () => {
    const applyControl = vi.fn(async () => {});
    const { controls, root } = renderControls(makeHost({ applyControl }));
    control(root, "Effort").click();
    const high = Array.from(document.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option"))
      .find((button) => button.textContent === "High");
    high?.click();

    await vi.waitFor(() => expect(applyControl).toHaveBeenCalledWith("effort", "high"));
    controls.destroy();
  });
});
