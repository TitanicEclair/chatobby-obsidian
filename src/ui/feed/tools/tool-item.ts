// ToolItemView — one tool call rendered as a compact row that expands to its result.
//
// Collapsed (default): [icon] verb  primary-arg ............ [status dot] [copy] [▸]
// Expanded:            the formatted result (see tools/format.ts renderToolDetail).
//
// The operation label follows execution state: preparing, active, succeeded,
// failed, cancelled, or interrupted.

import { setIcon } from "obsidian";
import type { ToolItem, ToolItemStatus } from "../../../types";
import { ChatobbyComponent } from "../../shared/component";
import { formatDuration } from "../../shared/format";
import type { FeedHost } from "../index";
import { inputPreview, isExternalUrl, looksLikeVaultPath, primaryArgument, renderToolDetail, toolChangeStats } from "./format";

const STATUS_ICON: Record<ToolItemStatus, string | null> = {
  pending: "circle",
  running: "loader-circle",
  waiting: "pause-circle",
  succeeded: null,
  failed: "alert-circle",
  cancelled: "circle-slash",
  interrupted: "unplug",
};

export class ToolItemView extends ChatobbyComponent {
  private rowEl: HTMLElement | null = null;
  private iconEl: HTMLElement | null = null;
  private nameEl: HTMLElement | null = null;
  private argEl: HTMLElement | null = null;
  private detailEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private durationEl: HTMLElement | null = null;
  private isExpanded = false;

  constructor(private readonly host: FeedHost, private item: ToolItem) {
    super();
    this.isExpanded = item.isExpanded;
  }

  getArgs(): string { return this.item.arguments; }
  getStatus(): string { return this.item.status; }
  getResult(): unknown { return this.item.result; }
  get expanded(): boolean { return this.isExpanded; }

  sync(item: ToolItem): void {
    this.item = item;
    if (this.iconEl) setIcon(this.iconEl, item.iconToken ?? "wrench");
    if (this.argEl) this.renderArg(this.argEl);
    this.setStatus(item.status);
    this.setResult(item.result, item.isError ?? false);
    this.setExpanded(item.isExpanded);
  }

  setArgs(args: string): void {
    this.item = { ...this.item, arguments: args };
    if (this.nameEl) this.renderName(this.nameEl);
    if (this.argEl) this.renderArg(this.argEl);
    this.updateStats();
  }

  setStatus(status: ToolItemStatus): void {
    this.item = { ...this.item, status };
    this.container?.toggleClass("is-running", status === "running");
    this.container?.toggleClass("is-waiting", status === "waiting");
    this.container?.toggleClass("is-succeeded", status === "succeeded");
    this.container?.toggleClass("is-failed", status === "failed");
    this.container?.toggleClass("is-cancelled", status === "cancelled");
    this.container?.toggleClass("is-interrupted", status === "interrupted");
    this.container?.toggleClass("is-pending", status === "pending");
    if (this.nameEl) this.renderName(this.nameEl);
    this.updateDuration();
    if (this.statusEl) {
      this.statusEl.empty();
      const label = accessibleToolLabel(this.item);
      this.statusEl.setAttribute("aria-label", label);
      this.statusEl.setAttribute("title", label);
      const icon = STATUS_ICON[status];
      if (icon) {
        const dot = this.statusEl.createSpan({ cls: "chatobby-tool-item__dot", attr: { "aria-hidden": "true" } });
        setIcon(dot, icon);
        if (status === "running") dot.addClass("is-spinning");
      }
    }
    this.rowEl?.setAttribute("aria-label", accessibleToolLabel(this.item));
  }

  setResult(result: unknown, isError: boolean): void {
    this.item = { ...this.item, result, isError };
    this.updateDuration();
    this.updateStats();
    if (this.isExpanded && this.detailEl) renderToolDetail(this.detailEl, this.item);
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    this.setExpanded(this.isExpanded);
    this.persistExpanded(this.isExpanded);
  }

  setExpanded(expanded: boolean): void {
    this.isExpanded = expanded;
    this.item = { ...this.item, isExpanded: expanded };
    this.container?.toggleClass("is-expanded", expanded);
    this.rowEl?.setAttribute("aria-expanded", String(expanded));
    if (this.isExpanded && this.detailEl) renderToolDetail(this.detailEl, this.item);
  }

  protected onRender(container: HTMLElement): void {
    this.rowEl = container.createDiv({ cls: "chatobby-tool-item__row" });
    this.rowEl.setAttribute("role", "button");
    this.rowEl.setAttribute("tabindex", "0");
    this.rowEl.setAttribute("aria-expanded", String(this.item.isExpanded));
    this.rowEl.onclick = () => this.toggleExpanded();
    this.rowEl.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggleExpanded();
      }
    };

    this.iconEl = this.rowEl.createSpan({ cls: "chatobby-tool-item__icon" });
    setIcon(this.iconEl, this.item.iconToken ?? "wrench");

    this.nameEl = this.rowEl.createSpan({ cls: "chatobby-tool-item__name" });
    this.renderName(this.nameEl);
    this.argEl = this.rowEl.createSpan({ cls: "chatobby-tool-item__arg" });
    this.renderArg(this.argEl);

    this.statsEl = this.rowEl.createSpan({ cls: "chatobby-tool-item__stats" });
    this.rowEl.createSpan({ cls: "chatobby-tool-item__spacer" });
    this.durationEl = this.rowEl.createSpan({ cls: "chatobby-tool-item__duration" });

    this.statusEl = this.rowEl.createSpan({ cls: "chatobby-tool-item__status" });
    this.statusEl.setAttribute("role", "status");
    this.statusEl.setAttribute("aria-live", "polite");

    const copy = this.rowEl.createEl("button", {
      cls: "chatobby-tool-item__copy clickable-icon",
      attr: { "aria-label": "Copy result", title: "Copy result" },
    });
    setIcon(copy, "copy");
    copy.onclick = (event) => {
      event.stopPropagation();
      this.host.copyToClipboard(stringifyForCopy(this.item));
    };

    const chevron = this.rowEl.createSpan({ cls: "chatobby-tool-item__chevron" });
    setIcon(chevron, "chevron-down");

    this.detailEl = container.createDiv({ cls: "chatobby-tool-item__detail" });
    this.setStatus(this.item.status);
    this.updateStats();
    this.setExpanded(this.item.isExpanded);
  }

  protected componentClass(): string {
    return "chatobby-tool-item";
  }

  private renderName(el: HTMLElement): void {
    el.textContent = this.item.displayTitle;
  }

  private renderArg(el: HTMLElement): void {
    el.empty();
    const arg = primaryArgument(this.item);
    if (!arg) {
      const preview = inputPreview(this.item);
      if (preview) el.createSpan({ cls: "chatobby-tool-item__arg-text", text: preview });
      return;
    }

    if (isExternalUrl(arg)) {
      const link = el.createEl("a", {
        cls: "chatobby-tool-item__arg-link",
        text: arg,
        attr: { href: arg, target: "_blank", rel: "noopener" },
      });
      link.addEventListener("click", (e) => e.stopPropagation());
    } else if (looksLikeVaultPath(arg) && this.host.openVaultLink) {
      const link = el.createEl("a", {
        cls: "chatobby-tool-item__arg-link",
        text: displayPath(arg),
      });
      link.addEventListener("click", (e) => {
        e.stopPropagation();
        this.host.openVaultLink(stripExtension(arg));
      });
    } else {
      el.createSpan({ cls: "chatobby-tool-item__arg-text", text: arg });
    }
  }

  private updateDuration(): void {
    if (!this.durationEl) return;
    const durationMs = toolDurationMs(this.item);
    this.durationEl.textContent = durationMs == null ? "" : formatDuration(durationMs);
  }

  private updateStats(): void {
    if (!this.statsEl) return;
    const stats = toolChangeStats(this.item);
    this.statsEl.empty();
    this.statsEl.toggleClass("is-empty", stats === null);
    if (!stats) return;
    if (stats.additions > 0) {
      this.statsEl.createSpan({ cls: "chatobby-tool-item__stat chatobby-tool-item__stat--add", text: `+${stats.additions}` });
    }
    if (stats.deletions > 0) {
      this.statsEl.createSpan({ cls: "chatobby-tool-item__stat chatobby-tool-item__stat--del", text: `-${stats.deletions}` });
    }
  }

  private persistExpanded(expanded: boolean): void {
    this.host.feedViewActions.setToolExpanded(this.item.id, expanded);
  }
}

function accessibleToolLabel(item: ToolItem): string {
  const state = item.status === "pending" ? "queued" : item.status;
  return `${item.displayTitle}, ${state}`;
}

function stringifyForCopy(item: ToolItem): string {
  return typeof item.result === "string" ? item.result : JSON.stringify(item.result ?? item.arguments, null, 2);
}

function toolDurationMs(item: ToolItem): number | null {
  if (item.startTime == null) return null;
  const end = item.endTime ?? (item.status === "running" ? Date.now() : null);
  if (end == null) return null;
  return Math.max(0, end - item.startTime);
}

/** Strip file extension for display / wikilink text (e.g. "cerebrum.md" → "cerebrum"). */
function stripExtension(path: string): string {
  return path.replace(/\.(md|canvas|png|jpg|jpeg|gif|svg|webp|pdf|json|yaml|yml|css|js|ts|txt|csv)$/i, "");
}

/** Human-friendly display path: strip vault prefix, strip extension. */
function displayPath(path: string): string {
  return stripExtension(path).replace(/^\/+/, "");
}
