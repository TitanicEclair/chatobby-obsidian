import { setIcon } from "obsidian";
import { createFeedStore, type FeedStore } from "../../feed/public";
import { toFeedDocumentProjection } from "../../../frontend/feed-adapter";
import { ChatobbyComponent } from "../../../ui/shared/component";
import { buildComposerShell, resizeComposerInput } from "../../../ui/shell/view-shell";
import { FeedRenderer, type FeedHost } from "../../../ui/feed";
import type {
  FrontendSubagentArtifactViewModel as SubagentArtifactSummary,
  FrontendSubagentNodeViewModel as SubagentNodeSnapshot,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { SubagentScreenActions } from "../domain/screen-model";
import type { SubagentViewState } from "../state/subagent-store";
import { renderArtifacts, renderPendingDecision } from "./agent-resources";

export type SubagentFeedHostFactory = (getFeedStore: () => FeedStore) => FeedHost;

export interface AgentConversationViewProps {
  actions: SubagentScreenActions;
  createFeedHost: SubagentFeedHostFactory;
}

/** Normal conversation surface backed by a child-specific normalized feed store. */
export class AgentConversationView extends ChatobbyComponent {
  private readonly feedStore = createFeedStore();
  private feedRenderer: FeedRenderer | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private inputHighlightEl: HTMLElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private composerCardEl: HTMLElement | null = null;
  private composerErrorEl: HTMLElement | null = null;
  private controlsEl: HTMLElement | null = null;
  private decisionsEl: HTMLElement | null = null;
  private resourcesEl: HTMLElement | null = null;
  private earlierButton: HTMLButtonElement | null = null;
  private runId: string | null = null;
  private nodeId: string | null = null;
  private canMessage = false;
  private submitting = false;
  private steering = false;
  private activeDraftKey: string | null = null;
  private readonly drafts = new Map<string, string>();
  private controlFingerprint = "";
  private decisionFingerprint = "";
  private resourceFingerprint = "";

  constructor(private readonly props: AgentConversationViewProps) {
    super();
  }

  update(state: SubagentViewState): void {
    const run = state.selectedRunId ? state.runs.get(state.selectedRunId) : undefined;
    const node = run && state.selectedNodeId ? run.nodes[state.selectedNodeId] : undefined;
    if (!run || !node) {
      this.saveActiveDraft();
      this.activeDraftKey = null;
      this.runId = null;
      this.nodeId = null;
      this.feedStore.dispatch({ type: "feed.document-projection-synchronized", projection: { blocks: [] } });
      this.setComposerAvailability(false, "Loading agent conversation…");
      return;
    }
    this.runId = run.id;
    this.nodeId = node.id;
    this.activateDraft(`${run.id}:${node.id}`);
    this.feedStore.dispatch({
      type: "feed.document-projection-synchronized",
      projection: toFeedDocumentProjection(state.focusedFeed),
    });
    this.canMessage = ["queued", "running", "waiting", "paused"].includes(node.status);
    this.setComposerAvailability(this.canMessage, this.canMessage ? `Message ${node.label}…` : `Messaging unavailable for ${node.label}`);
    this.earlierButton?.toggleClass("is-hidden", !state.nextTranscriptCursor);
    this.renderControls(run.id, node.id, node.status, node.currentTool);
    this.renderDecisions(run.id, node);
    this.renderResources(node.id, state.artifacts.get(run.id) ?? []);
  }

  focusComposer(): void {
    this.inputEl?.focus();
  }

  destroy(): void {
    this.feedRenderer?.destroy();
    this.feedRenderer = null;
    super.destroy();
  }

  protected componentClass(): string {
    return "chatobby-subagent-conversation";
  }

  protected onRender(container: HTMLElement): void {
    const feedWrap = container.createDiv({ cls: "chatobby-subagent-conversation__feed-wrap chatobby-feed-wrap" });
    const feedEl = feedWrap.createDiv({ cls: "chatobby-feed" });
    this.earlierButton = feedWrap.createEl("button", {
      cls: "chatobby-subagent-conversation__earlier is-hidden",
      text: "Earlier",
      attr: { type: "button" },
    });
    this.earlierButton.addEventListener("click", () => {
      if (this.runId && this.nodeId) void this.props.actions.loadEarlierTranscript(this.runId, this.nodeId);
    });
    const baseHost = this.props.createFeedHost(() => this.feedStore);
    this.feedRenderer = new FeedRenderer({
      ...baseHost,
      getCurrentSubagentNodeId: () => this.nodeId,
      renderEmptyState: (empty) => {
        empty.createDiv({ cls: "chatobby-feed__empty-title", text: "No activity yet" });
      },
      onFeedEscape: () => this.focusComposer(),
    });
    this.feedRenderer.bind(feedEl);

    this.decisionsEl = container.createDiv({
      cls: "chatobby-subagent-conversation__decisions is-hidden",
      attr: { "aria-live": "polite" },
    });
    this.resourcesEl = container.createDiv({ cls: "chatobby-subagent-conversation__resources is-hidden" });
    this.renderComposer(container);
  }

  private renderComposer(container: HTMLElement): void {
    const composer = buildComposerShell(container, "Message agent", "chatobby-subagent-conversation__composer");
    composer.slashMenuEl.remove();
    composer.stopBtn.remove();
    this.composerCardEl = composer.cardEl;
    this.inputEl = composer.inputEl;
    this.inputEl.addClass("chatobby-subagent-conversation__input");
    this.inputHighlightEl = composer.inputHighlightEl;
    this.controlsEl = composer.controlsEl;
    this.controlsEl.addClass("chatobby-subagent-conversation__controls");
    this.sendButton = composer.sendBtn;
    this.composerErrorEl = composer.cardEl.createDiv({
      cls: "chatobby-subagent-conversation__composer-error is-hidden",
      attr: { role: "alert" },
    });
    this.inputEl.addEventListener("input", () => {
      if (!this.inputEl) return;
      resizeComposerInput(this.inputEl);
      this.syncInputPresentation();
      if (this.activeDraftKey) this.drafts.set(this.activeDraftKey, this.inputEl.value);
      this.updateSendAvailability();
    });
    this.inputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      void this.submit();
    });
    this.sendButton.addEventListener("click", () => void this.submit());
  }

  private renderControls(runId: string, nodeId: string, status: string, currentTool?: string): void {
    const fingerprint = `${runId}:${nodeId}:${status}:${currentTool ?? ""}:${this.steering}`;
    if (!this.controlsEl || fingerprint === this.controlFingerprint) return;
    this.controlFingerprint = fingerprint;
    this.controlsEl.empty();
    const state = this.controlsEl.createSpan({
      cls: `chatobby-subagent-conversation__status is-${status}`,
      attr: { title: status, "aria-label": status },
    });
    if (status === "running") {
      const spinner = state.createSpan({ cls: "chatobby-subagent-conversation__spinner", attr: { "aria-hidden": "true" } });
      setIcon(spinner, "loader-circle");
      if (currentTool) state.createSpan({ text: currentTool });
    } else {
      state.createSpan({ text: status });
    }
    if (status === "running") {
      this.addControl("pause", "Pause agent", () => this.props.actions.control(runId, undefined, "pause"));
      this.addControl("square", "Interrupt current action", () => this.props.actions.control(runId, nodeId, "interrupt"));
    }
    if (status === "paused") {
      this.addControl("play", "Resume agent", () => this.props.actions.control(runId, undefined, "resume"));
    }
    if (["queued", "running", "paused", "waiting"].includes(status)) {
      this.addControl("x", "Cancel agent", () => this.props.actions.control(runId, undefined, "cancel"), true);
    }
    const steer = this.controlsEl.createEl("button", {
      cls: `chatobby-subagent-conversation__control${this.steering ? " is-active" : ""}`,
      attr: {
        type: "button",
        title: this.steering ? "Steering mode on" : "Send as steering",
        "aria-label": "Toggle steering mode",
        "aria-pressed": String(this.steering),
      },
    });
    setIcon(steer, "route");
    steer.addEventListener("click", () => {
      this.steering = !this.steering;
      this.controlFingerprint = "";
      this.renderControls(runId, nodeId, status, currentTool);
    });
  }

  private addControl(icon: string, label: string, action: () => Promise<void>, danger = false): void {
    if (!this.controlsEl) return;
    const button = this.controlsEl.createEl("button", {
      cls: `chatobby-subagent-conversation__control${danger ? " is-danger" : ""}`,
      attr: { type: "button", title: label, "aria-label": label },
    });
    setIcon(button, icon);
    button.addEventListener("click", () => void this.runButtonAction(button, action));
  }

  private renderDecisions(
    runId: string,
    node: SubagentNodeSnapshot,
  ): void {
    if (!this.decisionsEl) return;
    const fingerprint = JSON.stringify([node.pendingPermission ?? null, node.acceptanceRecord ?? null]);
    if (fingerprint === this.decisionFingerprint) return;
    this.decisionFingerprint = fingerprint;
    this.decisionsEl.empty();
    renderPendingDecision(this.decisionsEl, runId, node, this.props.actions);
    this.decisionsEl.toggleClass("is-hidden", this.decisionsEl.childElementCount === 0);
  }

  private renderResources(
    nodeId: string,
    artifacts: readonly SubagentArtifactSummary[],
  ): void {
    if (!this.resourcesEl) return;
    const visible = artifacts.filter((artifact) => artifact.nodeId === nodeId && artifact.kind !== "transcript");
    const fingerprint = visible.map((artifact) => `${artifact.id}:${artifact.revision}:${artifact.promotedVaultPath ?? ""}`).join("|");
    if (fingerprint === this.resourceFingerprint) return;
    this.resourceFingerprint = fingerprint;
    this.resourcesEl.empty();
    if (visible.length === 0) {
      this.resourcesEl.addClass("is-hidden");
      return;
    }
    this.resourcesEl.removeClass("is-hidden");
    const details = this.resourcesEl.createEl("details");
    details.createEl("summary", { text: `${visible.length} artifact${visible.length === 1 ? "" : "s"}` });
    renderArtifacts(details, visible, this.props.actions);
  }

  private setComposerAvailability(enabled: boolean, placeholder: string): void {
    if (this.inputEl) {
      this.inputEl.disabled = !enabled;
      this.inputEl.placeholder = placeholder;
    }
    this.updateSendAvailability();
  }

  private activateDraft(key: string): void {
    if (key === this.activeDraftKey) return;
    this.saveActiveDraft();
    this.activeDraftKey = key;
    if (!this.inputEl) return;
    this.inputEl.value = this.drafts.get(key) ?? "";
    resizeComposerInput(this.inputEl);
    this.syncInputPresentation();
    this.updateSendAvailability();
  }

  private saveActiveDraft(): void {
    if (this.activeDraftKey && this.inputEl) this.drafts.set(this.activeDraftKey, this.inputEl.value);
  }

  private syncInputPresentation(): void {
    if (!this.inputEl || !this.inputHighlightEl) return;
    this.inputHighlightEl.textContent = this.inputEl.value;
  }

  private updateSendAvailability(): void {
    if (!this.sendButton) return;
    this.sendButton.disabled = !this.canMessage || this.submitting || !(this.inputEl?.value.trim());
  }

  private async submit(): Promise<void> {
    const text = this.inputEl?.value.trim() ?? "";
    if (!text || !this.runId || !this.nodeId || !this.canMessage || !this.sendButton) return;
    this.submitting = true;
    this.composerCardEl?.setAttr("aria-busy", "true");
    this.composerErrorEl?.addClass("is-hidden");
    this.updateSendAvailability();
    try {
      await this.props.actions.sendMessage(this.runId, this.nodeId, text, this.steering ? "steer" : "inform");
      if (this.inputEl) {
        this.inputEl.value = "";
        if (this.activeDraftKey) this.drafts.set(this.activeDraftKey, "");
        resizeComposerInput(this.inputEl);
        this.syncInputPresentation();
      }
    } catch (error) {
      if (this.composerErrorEl) {
        this.composerErrorEl.setText(error instanceof Error ? error.message : "Message could not be sent.");
        this.composerErrorEl.removeClass("is-hidden");
      }
    } finally {
      this.submitting = false;
      this.composerCardEl?.removeAttribute("aria-busy");
      this.updateSendAvailability();
    }
  }

  private async runButtonAction(button: HTMLButtonElement, action: () => Promise<void>): Promise<void> {
    button.disabled = true;
    try {
      await action();
    } finally {
      button.disabled = false;
    }
  }
}
