import { Notice, Setting } from "obsidian";
import type ChatobbyPlugin from "../../../main";
import type { PluginSettings } from "../domain/settings";
import type { RuntimeLifecycleState } from "../../../runtime/public";
import { formatCommandArgs, splitCommandArgs } from "../../../backend/command-line";

export function renderRuntimeSettings(containerEl: HTMLElement, plugin: ChatobbyPlugin, refresh: () => void): void {
    new Setting(containerEl).setName("Runtime").setHeading();
    const runtimeMode = plugin.getRuntimeMode();

    const runtimeState = plugin.getRuntimeState();
    const runtimeSetting = new Setting(containerEl)
      .setName("Chatobby runtime")
      .setDesc(runtimeStatusDescription(runtimeState));
    if (plugin.isReleaseBuild() && runtimeState.status !== "ready") {
      runtimeSetting.addButton((button) =>
        button
          .setButtonText("Install runtime")
          .onClick(() => plugin.openRuntimeInstaller()),
      );
    } else if (plugin.isReleaseBuild()) {
      runtimeSetting.addButton((button) =>
        button
          .setButtonText("Check for updates")
          .onClick(() => plugin.openRuntimeInstaller()),
      );
    }
    runtimeSetting.addButton((button) => {
      const ready = runtimeState.status === "ready";
      button.setButtonText(ready ? "Restart" : "Check again").onClick(() => {
        const action = ready
          ? plugin.restartRuntime()
          : plugin.startBackend();
        action
          .then(() => refresh())
          .catch((error: unknown) => {
            console.error("Chatobby: runtime action failed", error);
            new Notice(
              error instanceof Error
                ? error.message
                : "Chatobby runtime action failed",
            );
            refresh();
          });
      });
    });

    if (plugin.isReleaseBuild()) {
      new Setting(containerEl)
        .setName("Runtime mode")
        .setDesc(
          "Managed. Release builds use only the signed runtime installed for Chatobby.",
        );
    } else {
      new Setting(containerEl)
        .setName("Runtime mode")
        .setDesc(
          "Managed is recommended. External connects without process ownership; Developer runs a custom local command.",
        )
        .addDropdown((dropdown) => {
          dropdown
            .addOption("managed", "Managed")
            .addOption("external", "External")
            .addOption("developer", "Developer")
            .setValue(runtimeMode)
            .onChange((value) => {
              plugin.updateSettings({
                runtimeMode: value as PluginSettings["runtimeMode"],
              })
                .then(() => refresh())
                .catch((error: unknown) => {
                  console.error(
                    "Chatobby: failed to update runtime mode",
                    error,
                  );
                  new Notice("Failed to update Chatobby runtime mode");
                });
            });
        });
    }

    new Setting(containerEl)
      .setName("Start when needed")
      .setDesc(plugin.usesAutomaticRuntimeProvisioning()
        ? "Start the already reconciled runtime when a Chatobby view needs it. Required runtime program files are verified independently after plugin load."
        : "Prepare Chatobby automatically when you open a Chatobby view.")
      .addToggle((toggle) => {
        toggle
          .setValue(plugin.settings.runtimeAutoStart)
          .onChange((value) => {
            plugin.updateSettings({ runtimeAutoStart: value }).catch(
              (error: unknown) => {
                console.error(
                  "Chatobby: failed to update runtime startup preference",
                  error,
                );
                new Notice("Failed to update runtime startup preference");
              },
            );
          });
      });

    if (runtimeMode === "managed") {
      new Setting(containerEl)
        .setName("Runtime lifetime")
        .setDesc(
          "Keep Chatobby only while Obsidian is open, or leave it available for explicitly permitted background Events.",
        )
        .addDropdown((dropdown) => {
          dropdown
            .addOption("obsidian-session", "While Obsidian is open")
            .addOption("background", "Allow background Events")
            .setValue(plugin.settings.runtimeLifetime)
            .onChange((value) => {
              plugin.updateSettings({
                runtimeLifetime:
                  value === "background" ? "background" : "obsidian-session",
              })
                .then(() => refresh())
                .catch((error: unknown) => {
                  console.error(
                    "Chatobby: failed to update runtime lifetime",
                    error,
                  );
                  new Notice("Failed to update Chatobby runtime lifetime");
                });
            });
        });
      if (plugin.settings.runtimeLifetime === "background") {
        containerEl.createDiv({
          cls: "chatobby-settings-note",
          text: "Background mode may continue work after Obsidian closes. Each Event still requires its own background permission, approval policy, and execution budget.",
        });
      }
    }

    if (runtimeMode === "external") {
      new Setting(containerEl)
        .setName("External server URL")
        .setDesc(
          "WebSocket endpoint owned outside Obsidian. Chatobby will connect but will not start or stop it.",
        )
        .addText((text) => {
          text
            .setPlaceholder("ws://127.0.0.1:9222")
            .setValue(plugin.settings.externalServerUrl)
            .onChange((value) => {
              plugin
                .setExternalServerUrl(value.trim())
                .catch((error: unknown) => {
                  console.error(
                    "Chatobby: failed to update external server URL",
                    error,
                  );
                  new Notice("Failed to update external Chatobby server URL");
                });
            });
        });
    }

    if (runtimeMode === "developer") {
      new Setting(containerEl)
        .setName("Developer command")
        .setDesc(
          "Local command used to launch the runtime. Chatobby supplies identity, port, vault, and credential arguments.",
        )
        .addText((text) => {
          text
            .setPlaceholder("chatobby")
            .setValue(plugin.settings.developerCommand)
            .onChange((value) => {
              plugin.updateSettings({ developerCommand: value.trim() }).catch(
                (error: unknown) => {
                  console.error(
                    "Chatobby: failed to update developer command",
                    error,
                  );
                  new Notice("Failed to update Chatobby developer command");
                },
              );
            });
        });

      new Setting(containerEl)
        .setName("Developer arguments")
        .setDesc(
          "Optional command arguments. Runtime lifecycle arguments are reserved and cannot be overridden.",
        )
        .addText((text) => {
          text
            .setValue(formatCommandArgs(plugin.settings.developerArgs))
            .onChange((value) => {
              plugin.updateSettings({
                developerArgs: splitCommandArgs(value),
              }).catch((error: unknown) => {
                console.error(
                  "Chatobby: failed to update developer arguments",
                  error,
                );
                new Notice("Failed to update Chatobby developer arguments");
              });
            });
        });
    }

    new Setting(containerEl)
      .setName("Command shell")
      .setDesc(
        "Automatic uses Windows PowerShell on Windows and your configured shell or Bash/sh on macOS and Linux. You can select an installed shell. Restart Chatobby to apply changes.",
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption("auto", "Automatic (recommended)")
          .addOption("pwsh", "PowerShell 7")
          .addOption("powershell", "Windows PowerShell")
          .addOption("cmd", "Command Prompt")
          .addOption("bash", "Bash")
          .addOption("zsh", "Zsh")
          .addOption("fish", "Fish")
          .addOption("sh", "POSIX sh")
          .addOption("custom", "Custom executable")
          .setValue(plugin.settings.commandShell)
          .onChange((value) => {
            plugin.updateSettings({
              commandShell: value as PluginSettings["commandShell"],
            })
              .then(() => {
                new Notice(
                  "Command shell saved. Restart Chatobby to apply it.",
                );
                refresh();
              })
              .catch((error: unknown) => {
                console.error(
                  "Chatobby: failed to update command shell",
                  error,
                );
                new Notice("Failed to update command shell");
              });
          });
      });

    if (plugin.settings.commandShell === "custom") {
      new Setting(containerEl)
        .setName("Shell executable")
        .setDesc(
          "Executable name on PATH or an absolute path, for example nu, tcsh, or /opt/homebrew/bin/fish.",
        )
        .addText((text) => {
          text
            .setPlaceholder("/path/to/shell")
            .setValue(plugin.settings.customShellPath)
            .onChange((value) => {
              plugin.updateSettings({ customShellPath: value.trim() })
                .then(() => {
                  new Notice(
                    "Command shell saved. Restart Chatobby to apply it.",
                  );
                })
                .catch((error: unknown) => {
                  console.error(
                    "Chatobby: failed to update custom shell",
                    error,
                  );
                  new Notice("Failed to update custom shell");
                });
            });
        });
    }
  }

function runtimeStatusDescription(state: RuntimeLifecycleState): string {
  switch (state.status) {
    case "idle":
      return "Not running.";
    case "resolving":
      return "Checking for this vault's runtime.";
    case "spawning":
      return `Starting runtime (attempt ${state.attempt}).`;
    case "authenticating":
      return "Verifying runtime identity and session access.";
    case "ready":
      return `Ready - ${state.runtime.identity.runtimeVersion} on ${state.runtime.ownership} mode.`;
    case "stopping":
      return "Stopping runtime safely.";
    case "detached":
      return "Detached. Session-owned work may reattach during the grace period.";
    case "error":
      return state.diagnostics.message;
    case "crash_loop":
      return `${state.diagnostics.message} Automatic restart paused.`;
  }
}
