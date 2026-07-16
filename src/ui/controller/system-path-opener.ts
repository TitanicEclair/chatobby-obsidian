import { Notice, type App } from "obsidian";

interface ElectronShell {
  openPath?: (target: string) => Promise<string>;
}

/** Open an absolute system path without coupling Electron fallbacks to the Chatobby view. */
export function openSystemPathExternally(app: App, path: string): void {
  const appWithDefaultOpen = app as App & { openWithDefaultApp?: (target: string) => Promise<void> };
  if (appWithDefaultOpen.openWithDefaultApp) {
    appWithDefaultOpen.openWithDefaultApp(path).catch((error) => reportFailure(path, error));
    return;
  }
  const electronRequire = (window as Window & {
    require?: (module: "electron") => { shell?: ElectronShell };
  }).require;
  try {
    const openPath = electronRequire?.("electron").shell?.openPath;
    if (openPath) {
      void openPath(path).then((error) => {
        if (error) reportFailure(path, error);
      }).catch((error: unknown) => reportFailure(path, error));
      return;
    }
  } catch (error) {
    console.error("Chatobby: failed to access Electron shell", error);
  }
  new Notice("Opening system paths is unavailable in this Obsidian environment.");
}

function reportFailure(path: string, error: unknown): void {
  console.error("Chatobby: failed to open system path", error);
  new Notice(`Failed to open path: ${path}`);
}
