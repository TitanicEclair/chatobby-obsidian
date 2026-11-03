import { Notice, Setting } from "obsidian";
import type ChatobbyPlugin from "../../../main";

export function renderDocumentSettings(containerEl: HTMLElement, plugin: ChatobbyPlugin, refresh: () => void): void {
    new Setting(containerEl).setName("Documents").setHeading();

    new Setting(containerEl)
      .setName("Document OCR")
      .setDesc(
        "Built-in OCR handles scanned images and image-only PDFs. Advanced local OCR preserves more layout but requires MinerU to be installed separately.",
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("builtin", "Built-in OCR (recommended)")
          .addOption("advanced", "Advanced local OCR")
          .setValue(plugin.settings.documentOcrEngine)
          .onChange((value) => {
            plugin.updateSettings({
              documentOcrEngine: value === "advanced" ? "advanced" : "builtin",
            })
              .then(() => {
                new Notice(
                  "Document OCR setting saved. Restart Chatobby to apply it.",
                );
                refresh();
              })
              .catch((error: unknown) => {
                console.error("Chatobby: failed to update document OCR", error);
                new Notice("Failed to update document OCR");
              });
          }),
      );

    new Setting(containerEl)
      .setName("OCR language")
      .setDesc(
        "Tesseract language code, for example eng or eng+fra. English is available by default; other languages may download data on first use.",
      )
      .addText((text) =>
        text
          .setPlaceholder("eng")
          .setValue(plugin.settings.documentOcrLanguage)
          .onChange((value) => {
            plugin.updateSettings({ documentOcrLanguage: value.trim() || "eng" })
              .then(
                () =>
                  new Notice(
                    "OCR language saved. Restart Chatobby to apply it.",
                  ),
              )
              .catch((error: unknown) => {
                console.error("Chatobby: failed to update OCR language", error);
                new Notice("Failed to update OCR language");
              });
          }),
      );

    if (plugin.settings.documentOcrEngine === "advanced") {
      new Setting(containerEl)
        .setName("Advanced OCR command")
        .setDesc(
          "MinerU executable name on PATH or an absolute executable path. Chatobby invokes it without a shell and applies a five-minute limit.",
        )
        .addText((text) =>
          text
            .setPlaceholder("mineru")
            .setValue(plugin.settings.advancedOcrCommand)
            .onChange((value) => {
              plugin.updateSettings({
                advancedOcrCommand: value.trim() || "mineru",
              })
                .then(
                  () =>
                    new Notice(
                      "Advanced OCR command saved. Restart Chatobby to apply it.",
                    ),
                )
                .catch((error: unknown) => {
                  console.error(
                    "Chatobby: failed to update advanced OCR command",
                    error,
                  );
                  new Notice("Failed to update advanced OCR command");
                });
            }),
        );
      containerEl.createDiv({
        cls: "chatobby-settings-note",
        text: "Advanced OCR is optional and model-inferred. Chatobby does not install model weights, alter Python, or bypass operating-system security settings.",
      });
    }
  }
