import { type App, Modal, Notice, setIcon } from "obsidian";
import type { PluginSettings } from "../../types";
import { CHATOBBY_CONNECTOR_REPOSITORY_URL, CHATOBBY_SUPPORT_URL, openChatobbyUrl } from "../../publication";

export type IntroductionKind = "welcome" | "changes";
export const RELEASE_HIGHLIGHTS = [{
  version: "0.5.0",
  items: [
    { icon: "panels-top-left", title: "Native tabs and a new sidebar", description: "Open chats and Chatobby pages in Obsidian tabs. Organize chats in Projects and archive them when you’re done." },
    { icon: "shield-check", title: "Sandboxed tools", description: "Choose Read-only, Workspace or Full access, with a separate network control. Local tools follow the boundary you select." },
    { icon: "plug", title: "More ways to connect models", description: "Use local models, API keys, or supported ChatGPT, GitHub Copilot and xAI subscriptions." },
    { icon: "messages-square", title: "Agents that work together", description: "Write your own subagent prompts, coordinate in channels, send direct messages and schedule work with Events." },
  ],
}] as const;

export const PRODUCT_ROADMAP = [
  "More capable agent knowledge and memory",
  "New chat modes and effort modes",
  "Session chat annotations",
  "Inline note comments",
] as const;

export function compareProductVersions(left: string, right: string): number {
  const a = left.split(/[.-]/u).slice(0, 3).map(Number);
  const b = right.split(/[.-]/u).slice(0, 3).map(Number);
  for (let i = 0; i < 3; i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return difference;
  }
  const aPre = left.includes("-") ? left.slice(left.indexOf("-") + 1).split(".") : [];
  const bPre = right.includes("-") ? right.slice(right.indexOf("-") + 1).split(".") : [];
  if (!aPre.length || !bPre.length) return aPre.length ? -1 : bPre.length ? 1 : 0;
  for (let i = 0; i < Math.max(aPre.length, bPre.length); i++) {
    const x = aPre[i], y = bPre[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const xNumeric = /^\d+$/u.test(x), yNumeric = /^\d+$/u.test(y);
    if (xNumeric && yNumeric) return Number(x) - Number(y);
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function selectIntroduction(settings: Pick<PluginSettings, "onboardingVersion" | "lastSeenPluginVersion">, version: string): IntroductionKind | null {
  if (settings.lastSeenPluginVersion && compareProductVersions(version, settings.lastSeenPluginVersion) <= 0) return null;
  return settings.onboardingVersion === 0 && !settings.lastSeenPluginVersion ? "welcome" : "changes";
}

interface IntroductionHost {
  app: App;
  version: string;
  getSettings(): Pick<PluginSettings, "onboardingVersion" | "lastSeenPluginVersion">;
  save(patch: Partial<PluginSettings>): Promise<void>;
  openSettings(): Promise<void>;
}

/** Plugin-local presentation state; never depends on a model or runtime connection. */
export class ProductIntroduction {
  private modal: ProductIntroModal | null = null;
  private disposed = false;

  constructor(private readonly host: IntroductionHost) {}

  showInitial(): void {
    const kind = selectIntroduction(this.host.getSettings(), this.host.version);
    if (kind) this.show(kind);
  }

  show(kind: IntroductionKind = "changes"): void {
    if (this.modal || this.disposed) return;
    const previous = this.host.getSettings().lastSeenPluginVersion;
    this.modal = new ProductIntroModal(this.host.app, kind, this.host.version, previous, () => {
      this.modal = null;
      if (this.disposed) return;
      // A downgrade or manually reopening the notes must not lower the seen version.
      const seen = this.host.getSettings().lastSeenPluginVersion;
      const lastSeenPluginVersion = seen && compareProductVersions(seen, this.host.version) > 0 ? seen : this.host.version;
      void this.host.save({ onboardingVersion: Math.max(1, this.host.getSettings().onboardingVersion), lastSeenPluginVersion })
        .catch(() => new Notice("Chatobby could not save that this introduction was viewed."));
    }, () => this.host.openSettings());
    this.modal.open();
  }

  dispose(): void {
    this.disposed = true;
    this.modal?.close();
    this.modal = null;
  }
}

export class ProductIntroModal extends Modal {
  constructor(app: App, private readonly kind: IntroductionKind, private readonly version: string,
    private readonly previousVersion: string, private readonly dismissed: () => void,
    private readonly openSettings: () => Promise<void>) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("chatobby-intro");
    this.modalEl.toggleClass("chatobby-intro--welcome", this.kind === "welcome");
    this.titleEl.setText(this.kind === "welcome" ? "Welcome to Chatobby" : `Chatobby ${this.version}`);
    const hero = this.contentEl.createDiv({ cls: "chatobby-intro__hero" });
    const emblem = hero.createDiv({ cls: "chatobby-intro__emblem", attr: { "aria-hidden": "true" } });
    setIcon(emblem, this.kind === "welcome" ? "messages-square" : "panels-top-left");
    hero.createEl("p", { cls: "chatobby-intro__lead", text: this.kind === "welcome"
      ? "AI chats, agents and tools in Obsidian."
      : "A new interface, sandboxed tools, and more ways to connect." });
    if (this.kind === "welcome") this.renderWelcome();
    else this.renderChanges();
    const actions = this.contentEl.createDiv({ cls: "chatobby-intro__actions" });
    if (this.kind === "welcome") {
      actions.createEl("button", { text: "Explore first" }).addEventListener("click", () => this.close());
      actions.createEl("button", { text: "Open Settings", cls: "mod-cta" }).addEventListener("click", () => {
        this.close();
        void this.openSettings().catch(() => new Notice("Open Chatobby Settings from the sidebar to continue."));
      });
    } else {
      actions.createEl("button", { text: "Release notes" }).addEventListener("click", () => {
        openChatobbyUrl(`${CHATOBBY_CONNECTOR_REPOSITORY_URL}/releases/tag/${encodeURIComponent(this.version)}`);
      });
      actions.createEl("button", { text: "Continue", cls: "mod-cta" }).addEventListener("click", () => this.close());
    }
  }

  private renderWelcome(): void {
    const cards = this.contentEl.createDiv({ cls: "chatobby-intro__cards" });
    this.card(cards, "plug", "Connect a model", "Open Settings to add a local model, an API key, or a supported subscription account.");
    this.card(cards, "book-open", "Keep the Guide in your vault", "Settings also has the Chatobby Guide: add it to your vault for examples of Projects, memory, agents and channels.");
    this.contentEl.createEl("p", { cls: "chatobby-intro__footnote", text: "The core harness is free. No Chatobby account and no telemetry." });
  }

  private renderChanges(): void {
    const cards = this.contentEl.createDiv({ cls: "chatobby-intro__cards" });
    const releases = RELEASE_HIGHLIGHTS.filter(release => compareProductVersions(release.version, this.version) <= 0 &&
      (!this.previousVersion || compareProductVersions(release.version, this.previousVersion) > 0));
    // Manual reopening shows the current release's highlights too.
    const visible = releases.length ? releases : RELEASE_HIGHLIGHTS.filter(release => release.version === this.version);
    for (const release of visible) for (const item of release.items) this.card(cards, item.icon, item.title, item.description);
    if (!visible.length) cards.createEl("p", { text: "Open the release notes to see what changed in this update." });
    const roadmap = this.contentEl.createEl("section", { cls: "chatobby-intro__roadmap" });
    const heading = roadmap.createDiv({ cls: "chatobby-intro__roadmap-heading" });
    heading.createEl("h3", { text: "On the roadmap" });
    heading.createSpan({ text: "Planned" });
    const list = roadmap.createEl("ul");
    for (const item of PRODUCT_ROADMAP) list.createEl("li", { text: item });
    const feedback = this.contentEl.createEl("p", { cls: "chatobby-intro__feedback" });
    feedback.createSpan({ text: "Have an idea or found a bug? " });
    const link = feedback.createEl("a", { text: "Share feedback", href: CHATOBBY_SUPPORT_URL });
    link.addEventListener("click", event => { event.preventDefault(); openChatobbyUrl(CHATOBBY_SUPPORT_URL); });
  }

  private card(parent: HTMLElement, icon: string, title: string, description: string): void {
    const card = parent.createDiv({ cls: "chatobby-intro__card" });
    setIcon(card.createSpan({ cls: "chatobby-intro__icon", attr: { "aria-hidden": "true" } }), icon);
    const copy = card.createDiv();
    copy.createEl("h3", { text: title });
    copy.createEl("p", { text: description });
  }

  onClose(): void { this.contentEl.empty(); this.dismissed(); }
}
