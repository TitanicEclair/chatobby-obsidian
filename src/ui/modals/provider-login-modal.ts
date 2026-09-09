import { type App, Modal, Notice, Setting } from "obsidian";
import type { ChatobbyTransport } from "../../transport/ws-client";
import type { WsProviderInfo } from "../../types";
import type { ProviderLoginMethod, ProviderLoginState } from "../../vendor/chatobby-client/ws-client";

/** The runtime owns OAuth; this modal holds only the current, temporary interaction. */
export class ProviderLoginModal extends Modal {
  private transport?: ChatobbyTransport;
  private state?: ProviderLoginState;
  private closed = false;
  private timer?: number;
  private renderedStep = "";
  private statusEl?: HTMLElement;
  private interactionEl?: HTMLElement;
  private actionsEl?: HTMLElement;
  private inputValue = "";

  constructor(
    app: App,
    private readonly provider: WsProviderInfo,
    private readonly getTransport: () => Promise<ChatobbyTransport>,
    private readonly connected: () => Promise<void>,
  ) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("chatobby-provider-login");
    this.titleEl.setText(`Connect ${this.provider.authentication?.subscription?.label ?? this.provider.name}`);
    this.contentEl.createEl("p", { text: "Use your account with Chatobby’s agent, tools, and memory. Available models and usage follow your subscription." });
    this.statusEl = this.contentEl.createDiv({ cls: "chatobby-provider-login__status", attr: { role: "status", "aria-live": "polite" } });
    this.interactionEl = this.contentEl.createDiv({ cls: "chatobby-provider-login__interaction" });
    this.actionsEl = this.contentEl.createDiv({ cls: "chatobby-modal-actions" });
    this.renderMethods();
  }

  private setStatus(message: string): void {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  private renderMethods(): void {
    this.actionsEl?.empty();
    this.setStatus("Choose how to sign in.");
    for (const method of this.provider.authentication?.subscription?.methods ?? []) {
      const button = this.actionsEl?.createEl("button", {
        text: method === "browser" ? "Sign in with browser" : "Sign in with a code",
        cls: "mod-cta",
      });
      button?.addEventListener("click", () => { void this.start(method); });
    }
  }

  private async start(method: ProviderLoginMethod): Promise<void> {
    this.actionsEl?.empty();
    this.setStatus("Starting sign-in…");
    try {
      this.transport = await this.getTransport();
      if (this.closed) return;
      this.state = await this.transport.startProviderLogin(this.provider.id, method);
      if (this.closed) { await this.transport.cancelProviderLogin(this.state.loginId); return; }
      this.renderState();
      this.schedulePoll();
    } catch {
      if (this.closed) return;
      this.renderMethods();
      this.setStatus("Could not start sign-in. Check the runtime connection, then try again.");
    }
  }

  private schedulePoll(): void {
    if (this.closed || this.state?.status !== "pending") return;
    this.timer = window.setTimeout(() => { void this.poll(); }, 1000);
  }

  private async poll(): Promise<void> {
    if (this.closed || !this.state || !this.transport) return;
    try {
      this.state = await this.transport.getProviderLogin(this.state.loginId);
      if (this.closed) return;
      this.renderState();
      if (this.state.status === "connected") {
        await this.connected();
        new Notice(`${this.provider.name} connected`);
      }
      this.schedulePoll();
    } catch {
      if (this.closed) return;
      this.setStatus("The sign-in connection was interrupted. Close this window and start again.");
      this.interactionEl?.empty();
      this.actionsEl?.empty();
      this.addClose("Close");
    }
  }

  private renderState(): void {
    const state = this.state;
    if (!state || !this.interactionEl || !this.actionsEl) return;
    this.setStatus(state.message);
    const step = JSON.stringify([state.status, state.url, state.userCode, state.prompt?.id]);
    if (step === this.renderedStep) return; // Polling must not replace a focused input.
    this.renderedStep = step;
    this.inputValue = "";
    this.interactionEl.empty();
    this.actionsEl.empty();
    if (state.status !== "pending") {
      if (state.status === "failed") {
        const retry = this.actionsEl.createEl("button", { text: "Start again" });
        retry.addEventListener("click", () => this.renderMethods());
      }
      this.addClose("Done");
      return;
    }
    if (state.userCode) {
      this.interactionEl.createEl("code", { cls: "chatobby-provider-login__code", text: state.userCode });
      const copy = this.interactionEl.createEl("button", { text: "Copy code" });
      copy.addEventListener("click", () => {
        void navigator.clipboard.writeText(state.userCode ?? "").then(() => new Notice("Code copied")).catch(() => new Notice("Select the code to copy it manually"));
      });
    }
    if (state.url) {
      this.interactionEl.createEl("p", { text: new URL(state.url).hostname, cls: "chatobby-provider-login__host" });
      const open = this.interactionEl.createEl("button", { text: "Open in browser", cls: "mod-cta" });
      open.addEventListener("click", () => {
        if (state.url) window.open(state.url, "_external", "noopener,noreferrer");
      });
    }
    if (state.prompt) {
      const prompt = state.prompt;
      new Setting(this.interactionEl).setName(prompt.message).addText((text) => {
        text.setPlaceholder(prompt.placeholder ?? "").onChange((value) => { this.inputValue = value; });
        text.inputEl.autocomplete = "off";
        text.inputEl.spellcheck = false;
      });
      const submit = this.interactionEl.createEl("button", { text: "Continue" });
      submit.addEventListener("click", () => {
        if (!this.inputValue.trim() && !prompt.allowEmpty) { new Notice("Enter the sign-in response first"); return; }
        submit.disabled = true;
        const value = this.inputValue;
        this.inputValue = "";
        this.interactionEl?.querySelectorAll("input").forEach((input) => { input.value = ""; });
        void this.transport?.respondToProviderLogin(state.loginId, prompt.id, value).then((next) => {
          if (this.closed) return;
          this.state = next;
          this.renderState();
        }).catch(() => {
          submit.disabled = false;
          this.setStatus("This sign-in step changed or could not be submitted. Check the current step and try again.");
        });
      });
    }
    this.addClose("Cancel sign-in");
  }

  private addClose(label: string): void {
    this.actionsEl?.createEl("button", { text: label }).addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.closed = true;
    window.clearTimeout(this.timer);
    this.inputValue = "";
    if (this.state?.status === "pending") void this.transport?.cancelProviderLogin(this.state.loginId).catch(() => {});
    this.state = undefined;
    this.contentEl.empty();
  }
}
