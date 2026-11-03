import { Notice, Setting } from "obsidian";
import type ChatobbyPlugin from "../../../main";
import { DEFAULT_COMPOSER_KEYBINDINGS, type ComposerKeybindings, type ThinkingDisplay } from "../domain/settings";
import { composerKeybindingFromEvent, composerKeybindingLabel, type ComposerKeybindingAction } from "../../../ui/composer/keybindings";

const THINKING_DISPLAY_OPTIONS: ThinkingDisplay[] = [
  "hidden",
  "collapsed",
  "expanded",
];

export function renderDisplaySettings(containerEl: HTMLElement, plugin: ChatobbyPlugin, refresh: () => void): void {
    new Setting(containerEl).setName("Conversation").setHeading();

    new Setting(containerEl)
      .setName("Thinking blocks")
      .setDesc(
        "Choose whether reasoning is hidden, folded, or shown by default.",
      )
      .addDropdown((dropdown) => {
        for (const option of THINKING_DISPLAY_OPTIONS) {
          dropdown.addOption(option, labelThinkingDisplay(option));
        }
        dropdown
          .setValue(plugin.settings.thinkingDisplay)
          .onChange((value) => {
            plugin.updateSettings({
              thinkingDisplay: value as ThinkingDisplay,
            }).catch((error) => {
              console.error(
                "Chatobby: failed to update thinking display",
                error,
              );
              new Notice("Failed to update thinking display");
            });
          });
      });

    new Setting(containerEl)
      .setName("Auto-scroll")
      .setDesc(
        "Follow new output until you deliberately scroll away from the bottom.",
      )
      .addToggle((toggle) => {
        toggle.setValue(plugin.settings.autoScroll).onChange((value) => {
          plugin.updateSettings({ autoScroll: value }).catch((error) => {
            console.error("Chatobby: failed to update auto-scroll", error);
            new Notice("Failed to update auto-scroll");
          });
        });
      });

    new Setting(containerEl)
      .setName("Auto-name sessions")
      .setDesc(
        "Use the beginning of your prompt for free, or ask the active model to create a cleaner title.",
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption("truncate", "Beginning of prompt")
          .addOption("model", "Generate with model");
        dropdown
          .setValue(plugin.settings.autoNameStrategy)
          .onChange((value) => {
            plugin.updateSettings({
              autoNameStrategy: value as "truncate" | "model",
            }).catch((error) => {
              console.error(
                "Chatobby: failed to update auto-name strategy",
                error,
              );
              new Notice("Failed to update auto-name strategy");
            });
          });
      });

    new Setting(containerEl)
      .setName("Message box keys")
      .setDesc(
        "These keys depend on the cursor position, so they apply only while the Chatobby message box is focused.",
      );
    renderComposerKeybinding(plugin, refresh,
      containerEl,
      "previousMessage",
      "Previous message",
      "Recall earlier prompts when the cursor is at the beginning of the message.",
    );
    renderComposerKeybinding(plugin, refresh,
      containerEl,
      "nextMessage",
      "Next message",
      "Move toward newer recalled prompts when the cursor is at the end of the message.",
    );
    renderComposerKeybinding(plugin, refresh,
      containerEl,
      "cancelTurn",
      "Cancel turn",
      "Arm and confirm cancellation without affecting other Obsidian editors.",
    );
    new Setting(containerEl)
      .setName("Other Chatobby shortcuts")
      .setDesc(
        "Use Obsidian Settings → Hotkeys and search for Chatobby to bind page navigation, session actions, draft stashing, exports, and runtime controls.",
      );
  }

function renderComposerKeybinding(plugin: ChatobbyPlugin, refresh: () => void, containerEl: HTMLElement, action: ComposerKeybindingAction, name: string, description: string): void {
    const setting = new Setting(containerEl).setName(name).setDesc(description);
    setting.addText((text) => {
      text.setValue(
        composerKeybindingLabel(
          plugin.settings.composerKeybindings[action],
        ),
      );
      text.inputEl.readOnly = true;
      text.inputEl.setAttr(
        "aria-label",
        `${name} shortcut. Focus and press a replacement shortcut.`,
      );
      text.inputEl.addEventListener("keydown", (event) => {
        const binding = composerKeybindingFromEvent(event);
        if (!binding) return;
        event.preventDefault();
        event.stopPropagation();
        if (
          bindingUsedByAnotherAction(
            plugin.settings.composerKeybindings,
            action,
            binding,
          )
        ) {
          new Notice(
            `${composerKeybindingLabel(binding)} is already assigned to another Chatobby action.`,
          );
          return;
        }
        text.setValue(composerKeybindingLabel(binding));
        void plugin.updateSettings({
          composerKeybindings: {
            ...plugin.settings.composerKeybindings,
            [action]: binding,
          },
        }).catch((error) => {
          console.error("Chatobby: failed to update composer shortcut", error);
          new Notice("Failed to update composer shortcut");
        });
      });
    });
    setting.addButton((button) =>
      button
        .setButtonText("Reset")
        .setTooltip(`Reset ${name.toLowerCase()}`)
        .onClick(() => {
          void plugin.updateSettings({
            composerKeybindings: {
              ...plugin.settings.composerKeybindings,
              [action]: DEFAULT_COMPOSER_KEYBINDINGS[action],
            },
          })
            .then(() => refresh())
            .catch((error) => {
              console.error(
                "Chatobby: failed to reset composer shortcut",
                error,
              );
              new Notice("Failed to reset composer shortcut");
            });
        }),
    );
  }

function labelThinkingDisplay(value: ThinkingDisplay): string {
  switch (value) {
    case "hidden":
      return "Hidden";
    case "collapsed":
      return "Collapsed";
    case "expanded":
      return "Expanded";
  }
}

function bindingUsedByAnotherAction(
  bindings: ComposerKeybindings,
  action: ComposerKeybindingAction,
  binding: string,
): boolean {
  return (
    Object.entries(bindings) as Array<[ComposerKeybindingAction, string]>
  ).some(([candidate, value]) => candidate !== action && value === binding);
}
