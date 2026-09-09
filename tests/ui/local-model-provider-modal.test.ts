import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalModelProviderModal } from "../../src/ui/modals/local-model-provider-modal";
import type { WsLocalModelDiscoveryResult, WsLocalModelProvider } from "../../src/types";

afterEach(() => { document.body.replaceChildren(); });
const models: WsLocalModelDiscoveryResult = { status: "reachable", message: "2 models found", models: [
  { id: "org/qwen:8b", name: "Qwen", contextWindow: 8192, loaded: true },
  { id: "llama@Q4", name: "Llama", contextWindow: 32768, loaded: true, imageInput: true },
] };
function setup(provider?: WsLocalModelProvider, discovery = vi.fn(async () => models)) {
  const save = vi.fn(async () => {});
  const test = vi.fn(async () => ({ status: "reachable" as const, message: "Model responded", latencyMs: 1, advertisedModelIds: [] }));
  const modal = new LocalModelProviderModal({} as App, provider, save, test, discovery); modal.open();
  return { modal, save, test, discovery, root: modal.modalEl };
}
function button(root: HTMLElement, text: string): HTMLButtonElement {
  const el = [...root.querySelectorAll("button")].find(button => button.textContent === text);
  if (!el) throw new Error(`Missing button ${text}`); return el;
}
function input(root: HTMLElement, selector: string, value: string): void {
  const el = root.querySelector<HTMLInputElement>(selector); if (!el) throw new Error(`Missing ${selector}`);
  el.value = value; el.dispatchEvent(new Event("input"));
}
function selectModel(root: HTMLElement, index: number): void {
  const el = root.querySelectorAll<HTMLInputElement>(".chatobby-local-model-modal__model-heading input")[index]!;
  el.checked = true; el.dispatchEvent(new Event("change"));
}

describe("local model connection form", () => {
  it("discovers and saves separate model settings with server defaults and a unique connection ID", async () => {
    const first = setup(); button(first.root, "Find models").click();
    await vi.waitFor(() => expect(first.root.textContent).toContain("2 models found"));
    selectModel(first.root, 0); selectModel(first.root, 1);
    button(first.root, "Save connection").click();
    await vi.waitFor(() => expect(first.save).toHaveBeenCalledOnce());
    const saved = first.save.mock.calls[0] as unknown as [WsLocalModelProvider];
    expect(saved[0].models.map(model => [model.id, model.contextWindow, model.outputLimit, model.imageInput]))
      .toEqual([["org/qwen:8b", 8192, "server", false], ["llama@Q4", 32768, "server", true]]);
    expect(saved[0].id).toMatch(/^local-/u);
    const second = setup(); button(second.root, "Find models").click();
    await vi.waitFor(() => expect(second.root.textContent).toContain("2 models found"));
    selectModel(second.root, 0); button(second.root, "Save connection").click();
    await vi.waitFor(() => expect(second.save).toHaveBeenCalledOnce());
    expect((second.save.mock.calls[0] as unknown as [WsLocalModelProvider])[0].id).not.toBe(saved[0].id);
  });
  it("preserves existing heterogeneous settings and credentials when editing", async () => {
    const provider: WsLocalModelProvider = { id: "existing", name: "My server", preset: "ollama", api: "openai-completions",
      baseUrl: "http://localhost:11434/v1", authentication: "bearer", models: [
        { id: "one", name: "One", contextWindow: 8192, maxTokens: 1024, reasoning: true, imageInput: false },
        { id: "two", name: "Two", contextWindow: 64000, maxTokens: 6000, reasoning: false, imageInput: true },
      ] };
    const form = setup(provider); button(form.root, "Save changes").click();
    await vi.waitFor(() => expect(form.save).toHaveBeenCalledWith(provider, undefined));
  });
  it("requires missing context without inventing a limit, while allowing a model test first", async () => {
    const form = setup(undefined, vi.fn(async () => ({ ...models, models: [{ id: "unloaded", name: "Unloaded" }] })));
    button(form.root, "Find models").click();
    await vi.waitFor(() => expect(form.root.textContent).toContain("Unloaded")); selectModel(form.root, 0);
    expect(form.root.querySelector<HTMLDetailsElement>(".chatobby-local-model-modal__model-settings")?.open).toBe(true);
    button(form.root, "Test").click(); await vi.waitFor(() => expect(form.test).toHaveBeenCalledOnce());
    button(form.root, "Save connection").click(); expect(form.save).not.toHaveBeenCalled();
    expect(form.root.textContent).toContain("Enter the configured context length");
    input(form.root, '[aria-label="Context tokens for unloaded"]', "8192");
    expect(form.root.querySelector(".chatobby-local-model-modal__model-settings > summary")?.textContent).toContain("8,192 context");
    button(form.root, "Save connection").click(); await vi.waitFor(() => expect(form.save).toHaveBeenCalledOnce());
    expect((form.save.mock.calls[0] as unknown as [WsLocalModelProvider])[0].models[0]).toMatchObject({ contextSource: "manual", contextWindow: 8192 });
  });
  it("keeps saved choices available after deselection without requiring discovery", async () => {
    const provider: WsLocalModelProvider = { id: "existing", name: "My server", preset: "ollama", api: "openai-completions",
      baseUrl: "http://localhost:11434/v1", authentication: "none", models: [
        { id: "one", name: "One", contextWindow: 8192, maxTokens: 1024, reasoning: true, imageInput: false },
      ] };
    const form = setup(provider);
    const checkbox = form.root.querySelector<HTMLInputElement>('.chatobby-local-model-modal__model-heading input')!;
    checkbox.checked = false; checkbox.dispatchEvent(new Event("change"));
    expect(form.root.textContent).toContain("One");
    selectModel(form.root, 0); button(form.root, "Save changes").click();
    await vi.waitFor(() => expect(form.save).toHaveBeenCalledWith(provider, undefined));
    expect(form.discovery).not.toHaveBeenCalled();
  });
  it("discards late discovery after changing the address and keeps the draft on error", async () => {
    let resolve!: (value: WsLocalModelDiscoveryResult) => void;
    const form = setup(undefined, vi.fn(() => new Promise<WsLocalModelDiscoveryResult>(done => { resolve = done; })));
    button(form.root, "Find models").click();
    input(form.root, '[aria-label="Server address"]', "http://localhost:9999/v1");
    resolve(models); await new Promise(done => setTimeout(done, 0));
    expect(form.root.textContent).not.toContain("Qwen");
    expect(form.root.querySelector<HTMLInputElement>('[aria-label="Server address"]')?.value).toBe("http://localhost:9999/v1");
  });
  it("tests the clicked model rather than the first selected model", async () => {
    const form = setup(); button(form.root, "Find models").click();
    await vi.waitFor(() => expect(form.root.textContent).toContain("Qwen"));
    selectModel(form.root, 0); selectModel(form.root, 1);
    form.root.querySelector<HTMLButtonElement>('[aria-label="Test Llama"]')!.click();
    await vi.waitFor(() => expect(form.test).toHaveBeenCalledOnce());
    expect((form.test.mock.calls[0] as unknown as [WsLocalModelProvider])[0].models[0]?.id).toBe("llama@Q4");
  });
  it("refreshes a deselected automatic model before selecting it again", async () => {
    const discovery = vi.fn(async () => structuredClone(models));
    const form = setup(undefined, discovery); button(form.root, "Find models").click();
    await vi.waitFor(() => expect(form.root.textContent).toContain("2 models found"));
    selectModel(form.root, 0);
    const checkbox = form.root.querySelector<HTMLInputElement>('.chatobby-local-model-modal__model-heading input')!;
    checkbox.checked = false; checkbox.dispatchEvent(new Event("change"));
    discovery.mockResolvedValueOnce({ ...models, models: [{ ...models.models[0]!, contextWindow: 16384 }] });
    button(form.root, "Refresh models").click();
    await vi.waitFor(() => expect(discovery).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(button(form.root, "Refresh models").disabled).toBe(false));
    selectModel(form.root, 0); button(form.root, "Save connection").click();
    await vi.waitFor(() => expect(form.save).toHaveBeenCalledOnce());
    expect((form.save.mock.calls[0] as unknown as [WsLocalModelProvider])[0].models[0]?.contextWindow).toBe(16384);
  });
  it("locks the draft while saving and restores it after a save failure", async () => {
    let reject!: (error: Error) => void;
    const form = setup();
    form.save.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    button(form.root, "Find models").click();
    await vi.waitFor(() => expect(form.root.textContent).toContain("2 models found"));
    selectModel(form.root, 0); button(form.root, "Save connection").click();
    expect(form.modal.contentEl.inert).toBe(true);
    reject(new Error("Connection changed elsewhere. Reopen to retry."));
    await vi.waitFor(() => expect(form.modal.contentEl.inert).toBe(false));
    expect(form.root.textContent).toContain("Connection changed elsewhere");
    expect(form.root.querySelector<HTMLInputElement>('.chatobby-local-model-modal__model-heading input')?.checked).toBe(true);
  });
});
