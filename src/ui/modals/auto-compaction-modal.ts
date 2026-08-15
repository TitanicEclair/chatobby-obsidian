import { Modal, Notice, Setting, type App } from "obsidian";
import type { WsAutoCompactionSettings } from "../../types";
import {
  AUTO_COMPACTION_MAX_THRESHOLD_PERCENT,
  AUTO_COMPACTION_MIN_THRESHOLD_PERCENT,
  AUTO_COMPACTION_THRESHOLD_STEP_PERCENT,
} from "../shared/constants";

export interface AutoCompactionModalOptions {
  model: string;
  settings: WsAutoCompactionSettings;
  save: (settings: { enabled: boolean; thresholdPercent: number }) => Promise<WsAutoCompactionSettings>;
}

/** Edits the automatic-compaction policy associated with one backend model. */
export class AutoCompactionModal extends Modal {
  private enabled: boolean;
  private thresholdPercent: number;
  private saving = false;

  constructor(app: App, private readonly options: AutoCompactionModalOptions) {
    super(app);
    this.enabled = options.settings.enabled;
    this.thresholdPercent = options.settings.thresholdPercent;
  }

  onOpen(): void {
    this.modalEl.addClass("chatobby-auto-compaction-modal");
    this.titleEl.setText("Automatic compaction");
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: "chatobby-auto-compaction-modal__model",
      text: this.options.model || "Current model",
    });
    this.contentEl.createDiv({
      cls: "chatobby-auto-compaction-modal__intro",
      text: "Chatobby summarizes older context before this model reaches its limit. This preference is saved for the model, not only this tab.",
    });

    new Setting(this.contentEl)
      .setName("Compact automatically")
      .setDesc("Recommended for long-running sessions and enabled by default.")
      .addToggle((toggle) => toggle
        .setValue(this.enabled)
        .onChange((enabled) => { this.enabled = enabled; }));

    const threshold = this.contentEl.createDiv({ cls: "chatobby-auto-compaction-modal__threshold" });
    const thresholdHeading = threshold.createDiv({ cls: "chatobby-auto-compaction-modal__threshold-heading" });
    const thresholdCopy = thresholdHeading.createDiv();
    thresholdCopy.createDiv({ cls: "setting-item-name", text: "Context threshold" });
    const thresholdDescription = thresholdCopy.createDiv({
      cls: "setting-item-description",
      text: "Start compaction when estimated context reaches this percentage.",
    });
    const thresholdValueEl = thresholdHeading.createEl("output", {
      cls: "chatobby-auto-compaction-modal__threshold-value",
      text: `${this.thresholdPercent}%`,
    });
    const sliderId = "chatobby-auto-compaction-threshold";
    const descriptionId = `${sliderId}-description`;
    thresholdDescription.id = descriptionId;
    thresholdValueEl.htmlFor = sliderId;

    const thresholdTrack = threshold.createDiv({ cls: "chatobby-auto-compaction-modal__threshold-track" });
    const slider = thresholdTrack.createEl("input", {
      cls: "chatobby-auto-compaction-modal__threshold-slider",
      attr: {
        id: sliderId,
        type: "range",
        min: String(AUTO_COMPACTION_MIN_THRESHOLD_PERCENT),
        max: String(AUTO_COMPACTION_MAX_THRESHOLD_PERCENT),
        step: String(AUTO_COMPACTION_THRESHOLD_STEP_PERCENT),
        value: String(this.thresholdPercent),
        "aria-label": "Automatic compaction threshold percentage",
        "aria-describedby": descriptionId,
      },
    });
    const updateThreshold = (): void => {
      this.thresholdPercent = Number(slider.value);
      thresholdValueEl.value = `${this.thresholdPercent}%`;
      const progress = (this.thresholdPercent - AUTO_COMPACTION_MIN_THRESHOLD_PERCENT)
        / (AUTO_COMPACTION_MAX_THRESHOLD_PERCENT - AUTO_COMPACTION_MIN_THRESHOLD_PERCENT);
      slider.style.setProperty("--chatobby-compaction-threshold-progress", `${progress * 100}%`);
    };
    slider.addEventListener("input", updateThreshold);
    slider.addEventListener("change", updateThreshold);
    updateThreshold();

    const bounds = threshold.createDiv({ cls: "chatobby-auto-compaction-modal__threshold-bounds" });
    bounds.createSpan({ text: `${AUTO_COMPACTION_MIN_THRESHOLD_PERCENT}% · earlier` });
    bounds.createSpan({ text: `later · ${AUTO_COMPACTION_MAX_THRESHOLD_PERCENT}%` });

    const safety = this.contentEl.createDiv({ cls: "chatobby-auto-compaction-modal__safety" });
    safety.createSpan({
      text: this.options.settings.effectiveThresholdPercent < this.options.settings.thresholdPercent
        ? `Current safety-adjusted trigger: ${this.options.settings.effectiveThresholdPercent}%. `
        : "",
    });
    safety.createSpan({
      text: "Chatobby may compact earlier when the model needs more room for its response.",
    });

    const actions = this.contentEl.createDiv({ cls: "chatobby-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", {
      cls: "mod-cta",
      text: "Save for model",
      attr: { type: "button" },
    });
    save.addEventListener("click", () => { void this.save(save, cancel); });
  }

  private async save(saveButton: HTMLButtonElement, cancelButton: HTMLButtonElement): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    saveButton.disabled = true;
    cancelButton.disabled = true;
    try {
      await this.options.save({ enabled: this.enabled, thresholdPercent: this.thresholdPercent });
      this.close();
    } catch (error) {
      console.error("Chatobby: could not save auto-compaction settings", error);
      new Notice(`Could not save automatic compaction: ${error instanceof Error ? error.message : String(error)}`);
      saveButton.disabled = false;
      cancelButton.disabled = false;
    } finally {
      this.saving = false;
    }
  }
}
