import { App, Modal, Setting, setIcon } from "obsidian";
import type { WsDiscoveredLocalModel, WsLocalModelDiscoveryResult, WsLocalModelProvider, WsLocalModelProviderProbeResult } from "../../types";

type LocalModel = WsLocalModelProvider["models"][number];
const PRESETS = {
  ollama: ["Ollama", "http://127.0.0.1:11434/v1"],
  "lm-studio": ["LM Studio", "http://127.0.0.1:1234/v1"],
  vllm: ["vLLM", "http://127.0.0.1:8000/v1"],
  "llama-cpp": ["llama.cpp", "http://127.0.0.1:8080/v1"],
  "openai-compatible": ["OpenAI-compatible", "http://127.0.0.1:8000/v1"],
  "anthropic-compatible": ["Anthropic-compatible", "http://127.0.0.1:8000/v1"],
} as const;

export class LocalModelProviderModal extends Modal {
  private candidate: WsLocalModelProvider;
  private readonly editing: boolean;
  private readonly discovered = new Map<string, WsDiscoveredLocalModel>();
  private readonly modelDrafts = new Map<string, LocalModel>();
  private readonly disclosures = new Map<string, boolean>();
  private apiKey = "";
  private generation = 0;
  private closed = false;
  private busy = false;
  private query = "";
  private list!: HTMLElement;
  private status!: HTMLElement;
  private footer!: HTMLElement;
  private findButton!: HTMLButtonElement;
  private selectedCount!: HTMLElement;
  private readonly saveProvider: (provider: WsLocalModelProvider, apiKey?: string) => Promise<void>;
  private readonly testProvider: (provider: WsLocalModelProvider, apiKey?: string) => Promise<WsLocalModelProviderProbeResult>;
  private readonly discoverModels: (provider: WsLocalModelProvider, apiKey?: string) => Promise<WsLocalModelDiscoveryResult>;

  constructor(app: App, provider: WsLocalModelProvider | undefined,
    save: (provider: WsLocalModelProvider, apiKey?: string) => Promise<void>,
    test: (provider: WsLocalModelProvider, apiKey?: string) => Promise<WsLocalModelProviderProbeResult>,
    discover: (provider: WsLocalModelProvider, apiKey?: string) => Promise<WsLocalModelDiscoveryResult>,
  ) {
    super(app);
    this.editing = Boolean(provider);
    this.candidate = provider ? structuredClone(provider) : {
      id: `local-${crypto.randomUUID()}`, name: "Ollama", preset: "ollama", api: "openai-completions",
      baseUrl: PRESETS.ollama[1], authentication: "none", compactionSchedulingClass: "local", models: [],
    };
    for (const model of this.candidate.models) this.modelDrafts.set(model.id, model);
    this.saveProvider = save; this.testProvider = test; this.discoverModels = discover;
  }

  onOpen(): void {
    this.modalEl.addClass("chatobby-provider-modal", "chatobby-local-model-modal");
    this.titleEl.setText(this.editing ? "Edit model server" : "Connect a model server");
    const form = this.contentEl.createDiv({ cls: "chatobby-local-model-modal__form" });
    new Setting(form).setName("Server").addDropdown(dropdown => {
      for (const [id, [label]] of Object.entries(PRESETS)) dropdown.addOption(id, label);
      dropdown.setValue(this.candidate.preset).onChange(value => {
        const preset = value as WsLocalModelProvider["preset"];
        if (this.candidate.name === PRESETS[this.candidate.preset][0]) this.candidate.name = PRESETS[preset][0];
        this.candidate.preset = preset;
        this.candidate.api = preset === "anthropic-compatible" ? "anthropic-messages" : "openai-completions";
        this.candidate.baseUrl = PRESETS[preset][1];
        this.candidate.authentication = preset === "anthropic-compatible" ? "api-key" : preset === "openai-compatible" ? "bearer" : "none";
        this.invalidateServer();
        // Preset changes intentionally replace the connection fields, preserving model overrides and token drafts.
        this.contentEl.empty(); this.onOpen();
      });
    });
    new Setting(form).setName("Address").addText(text => {
      text.inputEl.setAttribute("aria-label", "Server address");
      text.setValue(this.candidate.baseUrl).setPlaceholder(PRESETS[this.candidate.preset][1]).onChange(value => {
        this.candidate.baseUrl = value.trim(); this.invalidateServer();
      });
    });
    const tokenRow = form.createDiv();
    new Setting(form).setName("Authentication").addDropdown(dropdown => dropdown
      .addOption("none", "None").addOption("bearer", "Bearer token").addOption("api-key", "API key")
      .setValue(this.candidate.authentication).onChange(value => {
        this.candidate.authentication = value as WsLocalModelProvider["authentication"];
        this.invalidateServer(); renderToken();
      }));
    form.append(tokenRow);
    const renderToken = (): void => {
      tokenRow.empty();
      if (this.candidate.authentication === "none") return;
      new Setting(tokenRow).setName("Token").addText(text => {
        text.inputEl.type = "password";
        text.inputEl.setAttribute("aria-label", "Server token");
        text.setValue(this.apiKey).setPlaceholder(this.editing ? "Keep saved token" : "Enter token")
          .onChange(value => { this.apiKey = value; this.invalidateRequests(); });
      });
    };
    renderToken();
    const heading = form.createDiv({ cls: "chatobby-local-model-modal__heading" });
    heading.createEl("h3", { text: "Models" });
    this.selectedCount = heading.createSpan({ cls: "chatobby-local-model-modal__count" });
    this.findButton = heading.createEl("button", { text: "Find models", attr: { type: "button" } });
    this.setFindLabel("Find models");
    this.findButton.addEventListener("click", () => void this.findModels());
    const search = form.createEl("input", { type: "search", placeholder: "Filter models…", attr: { "aria-label": "Filter models" } });
    search.addClass("chatobby-local-model-modal__search");
    search.value = this.query;
    search.addEventListener("input", () => { this.query = search.value; this.renderModels(); });
    this.list = form.createDiv({ cls: "chatobby-local-model-modal__models" });
    this.renderModels();
    const manual = form.createEl("details", { cls: "chatobby-local-model-modal__manual" });
    manual.createEl("summary", { text: "Add a model by ID" });
    let manualId = "";
    const manualSetting = new Setting(manual).setName("Model ID").addText(text => text
      .setPlaceholder("e.g. qwen3:8b").onChange(value => { manualId = value.trim(); }));
    manualSetting.addButton(button => button.setButtonText("Add model").onClick(() => {
      if (!manualId || manualId.length > 200) { this.showStatus("Enter a model ID.", true); return; }
      if (this.candidate.models.some(model => model.id === manualId)) { this.showStatus("That model is already selected.", true); return; }
      const model = this.newModel({ id: manualId, name: manualId });
      this.modelDrafts.set(manualId, model); this.candidate.models.push(model);
      this.renderModels(); this.showStatus("");
    }));
    const advanced = form.createEl("details", { cls: "chatobby-local-model-modal__advanced" });
    advanced.createEl("summary", { text: "Advanced" });
    new Setting(advanced).setName("Connection name").addText(text => text.setValue(this.candidate.name)
      .onChange(value => { this.candidate.name = value; }));
    new Setting(advanced).setName("API format").addDropdown(dropdown => dropdown
      .addOption("openai-completions", "Chat Completions").addOption("openai-responses", "Responses")
      .addOption("anthropic-messages", "Messages").setValue(this.candidate.api).onChange(value => {
        this.candidate.api = value as WsLocalModelProvider["api"];
        this.invalidateRequests();
        if (value === "anthropic-messages") for (const model of this.candidate.models) model.outputLimit = "custom";
        this.renderModels();
      }));
    new Setting(advanced).setName("Connection kind").addDropdown(dropdown => {
      dropdown.selectEl.setAttribute("aria-label", "Model connection kind");
      dropdown.addOption("", "Unspecified").addOption("local", "Local / self-hosted").addOption("hosted", "Hosted")
        .setValue(this.candidate.compactionSchedulingClass ?? "").onChange(value => {
          if (value === "" || value === "local" || value === "hosted") this.candidate.compactionSchedulingClass = value || undefined;
        });
    });
    this.status = this.contentEl.createDiv({ cls: "chatobby-local-model-modal__status", attr: { role: "status", "aria-live": "polite" } });
    this.footer = this.contentEl.createDiv({ cls: "chatobby-modal-actions chatobby-local-model-modal__footer" });
    this.footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    this.footer.createEl("button", { text: this.editing ? "Save changes" : "Save connection", cls: "mod-cta" })
      .addEventListener("click", () => void this.save());
  }

  onClose(): void { this.closed = true; this.generation++; this.apiKey = ""; this.contentEl.empty(); }

  private invalidateRequests(): void {
    this.generation++; this.busy = false;
    if (this.findButton) { this.findButton.disabled = false; this.setFindLabel("Find models"); }
    if (this.status) this.showStatus("");
  }
  private setFindLabel(text: string): void {
    this.findButton.setText(text);
    const icon = this.findButton.createSpan(); setIcon(icon, "search"); this.findButton.prepend(icon);
  }
  private invalidateServer(): void {
    this.invalidateRequests(); this.discovered.clear();
    for (const id of this.modelDrafts.keys()) if (!this.candidate.models.some(model => model.id === id)) this.modelDrafts.delete(id);
    for (const model of this.modelDrafts.values()) if (model.contextSource === "server") model.contextWindow = 0;
    if (this.list) this.renderModels();
  }
  private showStatus(message: string, error = false): void {
    this.status.setText(message); this.status.toggleClass("is-error", error);
  }
  private validateConnection(): void {
    let url: URL;
    try { url = new URL(this.candidate.baseUrl); } catch { throw new Error("Enter a valid server address."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error("Use an HTTP or HTTPS address without credentials or query parameters.");
    if (!this.candidate.name.trim()) throw new Error("Enter a connection name.");
    if (!this.editing && this.candidate.authentication !== "none" && !this.apiKey.trim()) throw new Error("Enter the server token.");
  }
  private newModel(model: WsDiscoveredLocalModel): LocalModel {
    const contextWindow = model.contextWindow ?? 0;
    return { id: model.id, name: model.name, contextWindow, contextSource: "server",
      maxTokens: Math.min(4096, Math.max(1, Math.floor(contextWindow / 4))),
      outputLimit: this.candidate.api === "anthropic-messages" ? "custom" : "server",
      reasoning: model.reasoning ?? false, imageInput: model.imageInput ?? false };
  }
  private async findModels(): Promise<void> {
    if (this.busy) return;
    try { this.validateConnection(); } catch (error) { this.showStatus(message(error), true); return; }
    const generation = ++this.generation;
    this.busy = true; this.findButton.disabled = true; this.setFindLabel("Finding models…"); this.showStatus("");
    try {
      const result = await this.discoverModels({ ...this.candidate, models: [] }, this.apiKey.trim() || undefined);
      if (this.closed || generation !== this.generation) return;
      if (result.status !== "reachable") { this.showStatus(result.message, true); return; }
      this.discovered.clear();
      for (const item of result.models) this.discovered.set(item.id, item);
      for (const model of this.modelDrafts.values()) {
        const found = this.discovered.get(model.id);
        if (model.contextSource === "server" && found?.contextWindow) model.contextWindow = found.contextWindow;
      }
      this.renderModels(); this.showStatus(result.message);
    } catch (error) { if (!this.closed && generation === this.generation) this.showStatus(message(error), true); }
    finally { if (!this.closed && generation === this.generation) { this.busy = false; this.findButton.disabled = false; this.setFindLabel("Refresh models"); } }
  }
  private renderModels(): void {
    const scroll = this.list.scrollTop;
    this.list.empty();
    this.selectedCount.setText(`${this.candidate.models.length} selected`);
    const options = new Map(this.discovered);
    for (const model of this.modelDrafts.values()) if (!options.has(model.id)) options.set(model.id, { id: model.id, name: model.name });
    if (!options.size) this.list.createDiv({ cls: "chatobby-local-model-modal__empty", text: "Find models on your server to get started." });
    let visible = 0;
    for (const item of options.values()) {
      if (!`${item.name} ${item.id}`.toLowerCase().includes(this.query.toLowerCase())) continue;
      visible++;
      const model = this.candidate.models.find(model => model.id === item.id);
      const card = this.list.createDiv({ cls: "chatobby-local-model-modal__model" });
      const row = card.createDiv({ cls: "chatobby-local-model-modal__model-heading" });
      const label = row.createEl("label");
      const checkbox = label.createEl("input", { type: "checkbox", attr: { "aria-label": `Select ${item.id}` } }); checkbox.checked = Boolean(model);
      const name = label.createSpan(); name.createEl("strong", { text: model?.name ?? item.name });
      if (item.name !== item.id) name.createEl("small", { text: item.id });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          const selected = this.modelDrafts.get(item.id) ?? this.newModel(item);
          this.modelDrafts.set(item.id, selected); this.candidate.models.push(selected);
        }
        else this.candidate.models = this.candidate.models.filter(entry => entry.id !== item.id);
        this.renderModels();
        Array.from(this.list.querySelectorAll<HTMLInputElement>("input")).find(input => input.getAttribute("aria-label") === `Select ${item.id}`)?.focus();
      });
      if (item.loaded !== undefined) row.createSpan({ cls: "chatobby-local-model-modal__badge", text: item.loaded ? "Loaded" : "Not loaded" });
      if (model) {
        row.createEl("button", { text: "Test", attr: { type: "button", "aria-label": `Test ${model.name}` } })
          .addEventListener("click", event => void this.testModel(model, event.currentTarget as HTMLButtonElement));
        this.renderModelSettings(card, model, item);
      }
    }
    if (options.size && !visible) this.list.createDiv({ cls: "chatobby-local-model-modal__empty", text: "No matching models" });
    this.list.scrollTop = scroll;
  }
  private renderModelSettings(card: HTMLElement, model: LocalModel, found: WsDiscoveredLocalModel): void {
    const details = card.createEl("details", { cls: "chatobby-local-model-modal__model-settings" });
    details.open = this.disclosures.get(model.id) ?? model.contextWindow <= 0;
    details.addEventListener("toggle", () => { if (details.isConnected) this.disclosures.set(model.id, details.open); });
    const summary = details.createEl("summary");
    const updateSummary = (): void => summary.setText(model.contextWindow > 0
      ? `${model.contextWindow.toLocaleString()} context · ${model.outputLimit === "server" ? "Server output settings" : `${model.maxTokens.toLocaleString()} output`}`
      : "Context not reported — enter a limit");
    updateSummary();
    new Setting(details).setName("Display name").addText(text => text.setValue(model.name).onChange(value => { model.name = value; }));
    const contextInput = details.createDiv();
    let contextMode: HTMLSelectElement;
    const contextSetting = new Setting(details).setName("Context length").addDropdown(dropdown => {
      contextMode = dropdown.selectEl;
      dropdown.addOption("server", "Automatic").addOption("manual", "Custom").setValue(model.contextSource ?? "manual")
      .onChange(value => {
        model.contextSource = value as LocalModel["contextSource"];
        if (value === "server") model.contextWindow = found.contextWindow ?? 0;
        renderContext(); updateSummary();
      });
    });
    details.append(contextInput);
    const renderContext = (): void => {
      contextInput.empty();
      if (model.contextSource === "server" && model.contextWindow > 0) { contextSetting.setDesc(`${model.contextWindow.toLocaleString()} tokens · Server`); return; }
      contextSetting.setDesc(model.contextSource === "server" ? "Not reported" : "");
      new Setting(contextInput).setName("Context tokens").addText(text => {
        text.inputEl.type = "number"; text.inputEl.min = "1"; text.inputEl.setAttribute("aria-label", `Context tokens for ${model.id}`);
        text.setPlaceholder("Enter context length").setValue(model.contextWindow > 0 ? String(model.contextWindow) : "")
          .onChange(value => { model.contextWindow = Number(value); model.contextSource = "manual"; contextMode.value = "manual"; contextSetting.setDesc(""); updateSummary(); });
      });
    };
    renderContext();
    const outputInput = details.createDiv();
    new Setting(details).setName("Maximum output").addDropdown(dropdown => {
      if (this.candidate.api !== "anthropic-messages") dropdown.addOption("server", "Use server settings");
      dropdown.addOption("custom", "Custom").setValue(model.outputLimit ?? "custom").onChange(value => {
        model.outputLimit = value as LocalModel["outputLimit"]; renderOutput(); updateSummary();
      });
    });
    details.append(outputInput);
    const renderOutput = (): void => {
      outputInput.empty(); if (model.outputLimit === "server") return;
      new Setting(outputInput).setName("Output tokens").addText(text => {
        text.inputEl.type = "number"; text.inputEl.min = "1"; text.inputEl.setAttribute("aria-label", `Output tokens for ${model.id}`);
        text.setValue(String(model.maxTokens)).onChange(value => { model.maxTokens = Number(value); updateSummary(); });
      });
    };
    renderOutput();
    new Setting(details).setName("Reasoning").addToggle(toggle => toggle.setValue(model.reasoning).onChange(value => { model.reasoning = value; }));
    new Setting(details).setName("Image input").addToggle(toggle => toggle.setValue(model.imageInput).onChange(value => { model.imageInput = value; }));
  }
  private async testModel(model: LocalModel, button: HTMLButtonElement): Promise<void> {
    try { this.validateConnection(); } catch (error) { this.showStatus(message(error), true); return; }
    const generation = this.generation; button.disabled = true; button.setText("Testing…");
    try {
      // A one-token probe does not require knowing the context limit first.
      const result = await this.testProvider({ ...this.candidate, models: [{ ...model, contextWindow: Math.max(1, model.contextWindow), maxTokens: 1 }] }, this.apiKey.trim() || undefined);
      if (!this.closed && generation === this.generation) this.showStatus(result.message, result.status !== "reachable");
    } catch (error) { if (!this.closed && generation === this.generation) this.showStatus(message(error), true); }
    finally { button.disabled = false; button.setText("Test"); }
  }
  private async save(): Promise<void> {
    if (this.busy) return;
    try {
      this.validateConnection();
      if (!this.candidate.models.length) throw new Error("Select at least one model.");
      if (this.candidate.models.length > 100) throw new Error("Select up to 100 models per connection.");
      for (const model of this.candidate.models) {
        if (!model.name.trim()) throw new Error(`Enter a display name for ${model.id}.`);
        if (!Number.isSafeInteger(model.contextWindow) || model.contextWindow < 1 || model.contextWindow > 100_000_000)
          throw new Error(`Enter the configured context length for ${model.name}.`);
        if (model.outputLimit === "server") model.maxTokens = Math.max(1, Math.min(4096, Math.floor(model.contextWindow / 4)));
        if (!Number.isSafeInteger(model.maxTokens) || model.maxTokens < 1 || model.maxTokens > model.contextWindow)
          throw new Error(`Output tokens for ${model.name} must be between 1 and ${model.contextWindow.toLocaleString()}.`);
      }
      this.busy = true;
      this.contentEl.inert = true;
      this.footer.querySelectorAll("button").forEach(button => { button.disabled = true; });
      this.showStatus("Saving…");
      await this.saveProvider(structuredClone(this.candidate), this.apiKey.trim() || undefined);
      this.close();
    } catch (error) { if (!this.closed) this.showStatus(message(error), true); }
    finally { this.busy = false; this.contentEl.inert = false; this.footer.querySelectorAll("button").forEach(button => { button.disabled = false; }); }
  }
}

function message(error: unknown): string { return error instanceof Error ? error.message : "Could not complete the request. Try again."; }
