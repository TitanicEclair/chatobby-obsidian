import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { AutoCompactionModal } from "../../src/ui/modals/auto-compaction-modal";

describe("AutoCompactionModal", () => {
  it.each(["queued", "background"] as const)("saves an explicit %s override without changing the threshold", async (mode) => {
    const save = vi.fn(async (settings) => ({ ...settings, effectiveThresholdPercent: settings.thresholdPercent }));
    const modal = new AutoCompactionModal({} as App, {
      model: "synthetic/model", settings: { enabled: true, thresholdPercent: 72, effectiveThresholdPercent: 72, mode: "background" }, save,
    });
    modal.open();
    const select = modal.modalEl.querySelector<HTMLSelectElement>('[aria-label="Automatic compaction mode"]');
    if (!select) throw new Error("Mode control missing");
    select.value = mode;
    select.dispatchEvent(new Event("change"));
    expect(modal.modalEl.textContent).toContain("Other sessions and apps");
    expect(modal.modalEl.textContent).toContain("Compact now remains available");
    Array.from(modal.modalEl.querySelectorAll("button")).find((button) => button.textContent === "Save for model")?.click();
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith({ mode, enabled: true, thresholdPercent: 72 }));
  });
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
    expect(slider?.min).toBe("10");
    expect(slider?.max).toBe("95");
    expect(slider?.getAttribute("aria-label")).toBe("Automatic compaction threshold percentage");
    expect(readout?.textContent).toBe("85%");
    expect(modal.modalEl.textContent).toContain("Save for model");
    expect(modal.modalEl.textContent).toContain("provider-reported context usage");
    expect(modal.modalEl.textContent).not.toContain("estimated context");
    expect(modal.modalEl.querySelector<HTMLSelectElement>('[aria-label="Automatic compaction mode"]')?.value).toBe("background");

    if (!slider) throw new Error("compaction slider missing");
    slider.value = "72";
    slider.dispatchEvent(new Event("input"));
    expect(readout?.textContent).toBe("72%");
    expect(modal.modalEl.querySelectorAll(".chatobby-auto-compaction-modal__threshold-value")).toHaveLength(1);
    expect(modal.modalEl.querySelectorAll("input[type='range']")).toHaveLength(1);
  });
});
