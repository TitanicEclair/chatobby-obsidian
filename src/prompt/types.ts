

/** Vault context gathered before a prompt. */
export interface VaultContext {
  frontend: "obsidian";
  vault: string;
  appContext?: {
    contextId: string;
    sequence: number;
    capturedAt: string;
    revisions: {
      workspace: number;
      editor: number;
      page: number;
      capabilities: number;
    };
    focus?: {
      activeLeafId?: string;
      viewType: string;
      title?: string;
      path?: string;
    };
    workspace: { leafCount: number; openNoteCount: number };
    landmarks?: Array<{
      ref: string;
      role: string;
      name?: string;
      text?: string;
      href?: string;
      disabled?: boolean;
      checked?: boolean;
      expanded?: boolean;
    }>;
    inspection?: {
      leafId: string;
      documentId: string;
      documentRevision: string;
      capturedAt?: string;
      cursor?: string;
    };
  };
  environment?: VaultEnvironment;
  capabilities?: VaultCapabilityContext;
  notePath?: string;
  cursor?: { line: number; ch: number };
  selection?: string;
  selectionCharacters?: number;
  selectionTruncated?: boolean;
  contextExcerpt?: { fromLine: number; toLine: number; text: string };
  headings?: string[];
  headingCount?: number;
  headingsTruncated?: boolean;
  openNotes?: OpenNoteInfo[];
}

export interface VaultCapabilityContext {
  featureFamilies: string[];
  integrations: Array<{
    id: string;
    name: string;
    installed: boolean;
    enabled: boolean;
  }>;
  runtimeDependencies: Array<{
    id: string;
    name: string;
    available: boolean;
    detail?: string;
  }>;
}

export interface VaultEnvironment {
  time: {
    sentAtUtc: string;
    localDate: string;
    localTime: string;
    timeZone?: string;
    utcOffsetMinutes: number;
  };
  locale?: {
    primary?: string;
    languages?: string[];
  };
  device?: {
    platform?: string;
    userAgent?: string;
    hardwareConcurrency?: number;
    deviceMemoryGb?: number;
  };
  display?: {
    viewportWidth?: number;
    viewportHeight?: number;
    screenWidth?: number;
    screenHeight?: number;
    devicePixelRatio?: number;
    colorScheme?: "dark" | "light";
  };
  app?: {
    obsidianVersion?: string;
    chatobbyVersion?: string;
  };
  fileConventions?: ObsidianFileConventionFactsV1;
}

export interface ObsidianFileConventionFactsV1 {
  schemaVersion: 1;
  revision: string;
  observedAt: string;
  observationStatus: "exact" | "unavailable";
  generatedLinks?: {
    syntax: "wikilink" | "markdown";
    pathStyle: "shortest" | "relative" | "vault-absolute";
  };
  newAttachments?:
    | { mode: "vault-root" }
    | { mode: "same-folder-as-source" }
    | { mode: "subfolder-under-source"; subfolderName: string }
    | { mode: "vault-folder"; vaultRelativePath: string };
}

export interface OpenNoteInfo {
  path: string;
  title: string;
}
