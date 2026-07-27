export type AttachmentVisualKind =
  | "archive"
  | "audio"
  | "code"
  | "data"
  | "document"
  | "file"
  | "image"
  | "pdf"
  | "presentation"
  | "spreadsheet"
  | "video";

export interface AttachmentVisual {
  readonly icon: string;
  readonly kind: AttachmentVisualKind;
}

const ATTACHMENT_VISUALS: Readonly<Record<string, AttachmentVisual>> = {
  pdf: { icon: "file-text", kind: "pdf" },
  doc: { icon: "file-text", kind: "document" },
  docx: { icon: "file-text", kind: "document" },
  odt: { icon: "file-text", kind: "document" },
  rtf: { icon: "file-text", kind: "document" },
  pages: { icon: "file-text", kind: "document" },
  xls: { icon: "file-spreadsheet", kind: "spreadsheet" },
  xlsx: { icon: "file-spreadsheet", kind: "spreadsheet" },
  csv: { icon: "file-spreadsheet", kind: "spreadsheet" },
  tsv: { icon: "file-spreadsheet", kind: "spreadsheet" },
  ods: { icon: "file-spreadsheet", kind: "spreadsheet" },
  numbers: { icon: "file-spreadsheet", kind: "spreadsheet" },
  ppt: { icon: "presentation", kind: "presentation" },
  pptx: { icon: "presentation", kind: "presentation" },
  odp: { icon: "presentation", kind: "presentation" },
  key: { icon: "presentation", kind: "presentation" },
  zip: { icon: "file-archive", kind: "archive" },
  "7z": { icon: "file-archive", kind: "archive" },
  rar: { icon: "file-archive", kind: "archive" },
  tar: { icon: "file-archive", kind: "archive" },
  gz: { icon: "file-archive", kind: "archive" },
  bz2: { icon: "file-archive", kind: "archive" },
  xz: { icon: "file-archive", kind: "archive" },
  mp3: { icon: "file-audio", kind: "audio" },
  wav: { icon: "file-audio", kind: "audio" },
  m4a: { icon: "file-audio", kind: "audio" },
  aac: { icon: "file-audio", kind: "audio" },
  flac: { icon: "file-audio", kind: "audio" },
  ogg: { icon: "file-audio", kind: "audio" },
  mp4: { icon: "file-video", kind: "video" },
  mov: { icon: "file-video", kind: "video" },
  avi: { icon: "file-video", kind: "video" },
  mkv: { icon: "file-video", kind: "video" },
  webm: { icon: "file-video", kind: "video" },
  png: { icon: "file-image", kind: "image" },
  jpg: { icon: "file-image", kind: "image" },
  jpeg: { icon: "file-image", kind: "image" },
  gif: { icon: "file-image", kind: "image" },
  webp: { icon: "file-image", kind: "image" },
  svg: { icon: "file-image", kind: "image" },
  json: { icon: "file-json", kind: "data" },
  jsonc: { icon: "file-json", kind: "data" },
  jsonl: { icon: "file-json", kind: "data" },
  yaml: { icon: "file-json", kind: "data" },
  yml: { icon: "file-json", kind: "data" },
  xml: { icon: "file-json", kind: "data" },
  toml: { icon: "file-json", kind: "data" },
  sql: { icon: "database", kind: "data" },
};

const CODE_EXTENSIONS = new Set([
  "c", "cc", "cpp", "cs", "css", "dart", "go", "h", "hpp", "htm", "html", "java", "js", "jsx", "kt",
  "kts", "lua", "m", "php", "pl", "ps1", "py", "r", "rb", "rs", "scss", "sh", "swift", "ts", "tsx",
  "vue", "zsh",
]);

export function attachmentVisual(name: string, fallback: "image" | "text" | "file"): AttachmentVisual {
  const extension = extensionFor(name);
  const visual = ATTACHMENT_VISUALS[extension];
  if (visual) return visual;
  if (CODE_EXTENSIONS.has(extension)) return { icon: "file-code-2", kind: "code" };
  if (fallback === "image") return { icon: "file-image", kind: "image" };
  if (fallback === "text" || extension === "md" || extension === "txt") {
    return { icon: "file-text", kind: "document" };
  }
  return { icon: "file", kind: "file" };
}

export function attachmentMeta(name: string, fallbackLabel: string, sizeBytes?: number): string {
  const extension = extensionFor(name).toUpperCase();
  const kind = extension || fallbackLabel;
  return sizeBytes === undefined ? kind : `${kind} · ${formatFileSize(sizeBytes)}`;
}

function extensionFor(name: string): string {
  return /\.([^.]+)$/u.exec(name)?.[1]?.toLowerCase() ?? "";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`;
}
