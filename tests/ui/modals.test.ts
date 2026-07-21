import type { App } from "obsidian";
import { describe, expect, it } from "vitest";
import { PickModal } from "../../src/ui/modals/modals";

describe("PickModal", () => {
  it("commits a selection when Obsidian closes the modal before the choice callback", async () => {
    const selected = { id: "fork-point" };
    let resolve!: (value: typeof selected | null) => void;
    const result = new Promise<typeof selected | null>((settle) => { resolve = settle; });
    const modal = new PickModal({} as App, [selected], (item) => item.id, resolve);

    modal.onClose();
    modal.onChooseItem(selected);

    await expect(result).resolves.toBe(selected);
  });

  it("resolves to null when the picker is actually cancelled", async () => {
    const selected = { id: "fork-point" };
    let resolve!: (value: typeof selected | null) => void;
    const result = new Promise<typeof selected | null>((settle) => { resolve = settle; });
    const modal = new PickModal({} as App, [selected], (item) => item.id, resolve);

    modal.onClose();

    await expect(result).resolves.toBeNull();
  });
});
