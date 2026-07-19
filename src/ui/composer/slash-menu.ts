// SlashMenu — autocomplete popover for frontend-local and backend slash commands.

import { setIcon } from "obsidian";
import { ChatobbyComponent } from "../shared/component";
import type { SlashArgumentOption, SlashCommandSpec, SlashCommandSource } from "./slash-command";

const SOURCE_ICON: Record<SlashCommandSource, string> = {
  local: "terminal",
  extension: "puzzle",
  prompt: "file-text",
  skill: "sparkles",
};

export class SlashMenu extends ChatobbyComponent {
  private matches: SlashCommandSpec[] = [];
  private argumentOptions: SlashArgumentOption[] = [];
  private selected = 0;
  private mode: "command" | "argument" = "command";

  setMatches(matches: readonly SlashCommandSpec[]): void {
    this.matches = [...matches];
    this.argumentOptions = [];
    this.mode = "command";
    this.selected = 0;
    this.renderList();
  }

  setArgumentOptions(options: readonly SlashArgumentOption[]): void {
    this.argumentOptions = [...options];
    this.matches = [];
    this.mode = "argument";
    this.selected = 0;
    this.renderList();
  }

  get count(): number {
    return this.currentItemsLength();
  }

  get isOpen(): boolean {
    return this.currentItemsLength() > 0;
  }

  move(delta: 1 | -1): void {
    const length = this.currentItemsLength();
    if (length === 0) return;
    this.selected = (this.selected + delta + length) % length;
    this.renderList();
  }

  current(): SlashCommandSpec | null {
    if (this.mode !== "command") return null;
    return this.matches[this.selected] ?? null;
  }

  currentArgumentOption(): SlashArgumentOption | null {
    if (this.mode !== "argument") return null;
    return this.argumentOptions[this.selected] ?? null;
  }

  protected componentClass(): string {
    return "chatobby-slash-menu";
  }

  protected onRender(_container: HTMLElement): void {
    this.renderList();
  }

  private renderList(): void {
    const container = this.container;
    if (!container) return;
    container.empty();

    if (!this.isOpen) {
      container.createDiv({ cls: "chatobby-slash-menu__empty", text: "No matching command — it will be sent as-is" });
      return;
    }

    if (this.mode === "argument") {
      this.renderArgumentOptions(container);
      return;
    }

    const list = container.createDiv({ cls: "chatobby-slash-menu__list" });
    this.matches.forEach((cmd, index) => {
      const item = list.createDiv({ cls: `chatobby-slash-menu__item${index === this.selected ? " is-active" : ""}` });
      item.setAttr("aria-selected", index === this.selected ? "true" : "false");
      if (index === this.selected) scrollActiveItemIntoView(item);
      const icon = item.createSpan({ cls: "chatobby-slash-menu__icon" });
      setIcon(icon, SOURCE_ICON[cmd.source] ?? "square");
      const body = item.createDiv({ cls: "chatobby-slash-menu__body" });
      const commandLine = body.createDiv({ cls: "chatobby-slash-menu__command" });
      commandLine.createSpan({ cls: "chatobby-slash-menu__name", text: `/${cmd.name}` });
      if (cmd.usage) commandLine.createSpan({ cls: "chatobby-slash-menu__usage", text: cmd.usage });
      body.createSpan({ cls: "chatobby-slash-menu__desc", text: cmd.description ?? "" });
      if (index === this.selected) item.createEl("kbd", { cls: "chatobby-slash-menu__key", text: "Tab" });
    });
  }

  private renderArgumentOptions(container: HTMLElement): void {
    const list = container.createDiv({ cls: "chatobby-slash-menu__list" });
    this.argumentOptions.forEach((option, index) => {
      const item = list.createDiv({ cls: `chatobby-slash-menu__item${index === this.selected ? " is-active" : ""}` });
      item.setAttr("aria-selected", index === this.selected ? "true" : "false");
      if (index === this.selected) scrollActiveItemIntoView(item);
      const icon = item.createSpan({ cls: "chatobby-slash-menu__icon" });
      setIcon(icon, "list-plus");
      const body = item.createDiv({ cls: "chatobby-slash-menu__body" });
      body.createSpan({ cls: "chatobby-slash-menu__name", text: option.label });
      body.createSpan({ cls: "chatobby-slash-menu__desc", text: option.description ?? "" });
      if (index === this.selected) item.createEl("kbd", { cls: "chatobby-slash-menu__key", text: "Tab" });
    });
  }

  private currentItemsLength(): number {
    return this.mode === "command" ? this.matches.length : this.argumentOptions.length;
  }
}

function scrollActiveItemIntoView(item: HTMLElement): void {
  requestAnimationFrame(() => {
    item.scrollIntoView({ block: "nearest" });
  });
}
