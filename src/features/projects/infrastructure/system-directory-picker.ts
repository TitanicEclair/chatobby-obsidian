interface ElectronOpenDialogResult {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
}

interface ElectronDialog {
  showOpenDialog(
    window: unknown,
    options: {
      readonly title: string;
      readonly properties: readonly ("openDirectory" | "multiSelections" | "createDirectory")[];
    },
  ): Promise<ElectronOpenDialogResult>;
}

interface ElectronRemote {
  readonly dialog?: ElectronDialog;
  getCurrentWindow?(): unknown;
}

interface ElectronRendererModule {
  readonly remote?: ElectronRemote;
}

type ElectronAwareWindow = Window & {
  require?: (module: "electron") => ElectronRendererModule;
};

/** Opens the desktop directory chooser without persisting or projecting paths. */
export async function chooseSystemDirectories(
  title: string,
  multiple: boolean,
): Promise<readonly string[]> {
  const electronRequire = (window as ElectronAwareWindow).require;
  const remote = electronRequire?.("electron").remote;
  const dialog = remote?.dialog;
  if (!dialog) throw new Error("The system folder chooser is unavailable in this Obsidian window.");
  const result = await dialog.showOpenDialog(remote?.getCurrentWindow?.(), {
    title,
    properties: ["openDirectory", "createDirectory", ...(multiple ? ["multiSelections" as const] : [])],
  });
  if (result.canceled) return Object.freeze([]);
  return Object.freeze([...new Set(result.filePaths.map((path) => path.trim()).filter(Boolean))]);
}
