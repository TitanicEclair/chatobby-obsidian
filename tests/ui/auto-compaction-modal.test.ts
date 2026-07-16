import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { AutoCompactionModal } from "../../src/ui/modals/auto-compaction-modal";

describe("AutoCompactionModal", () => {
  it("renders a compatible slider with an exact persistent percentage", () => {
    const modal = new AutoCompactionModal({} as App, {
      model: "deepseek/deepseek-chat",
      settings: { enabled: true, thresholdPercent: 85, effectiveThresholdPercent: 82 },
      save: vi.fn(async (settings) => ({ ...settings, effectiveThresholdPercent: settings.thresholdPercent })),
    });

    modal.open();

    const slider = modal.modalEl.querySelector<HTMLInputElement>("input[type='range']");
    const readout = modal.modalEl.querySelector(".chatobby-auto-compaction-modal__threshold-value");
    expect(slider?.value).toBe("85");
    expect(slider?.getAttribute("aria-label")).toBe("Automatic compaction threshold percentage");
    expect(readout?.textContent).toBe("85%");
    expect(modal.modalEl.textContent).toContain("Save for model");

    if (!slider) throw new Error("compaction slider missing");
    slider.value = "72";
    slider.dispatchEvent(new Event("change"));
    expect(readout?.textContent).toBe("72%");
  });
});
