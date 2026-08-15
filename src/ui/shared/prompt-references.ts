export interface PromptReferencePresentation {
  readonly kind: "file" | "folder";
  readonly name: string;
  readonly path: string;
}

export interface ParsedPromptReferences {
  readonly text: string;
  readonly references: readonly PromptReferencePresentation[];
}

/**
 * Split the exact trailing reference syntax emitted by the composer from the
 * user's visible prose. The original prompt remains unchanged in transport and
 * durable history; this function controls presentation only.
 */
export function parsePromptReferences(value: string): ParsedPromptReferences {
  let text = value.trimEnd();
  const references: PromptReferencePresentation[] = [];

  while (text) {
    const match = /^(.*?)(?:\s*)@\[\[([^\]\r\n]+)\]\]\s*$/su.exec(text);
    if (!match) break;
    const rawPath = match[2]?.trim() ?? "";
    if (!rawPath) break;
    const kind = /[\\/]$/u.test(rawPath) ? "folder" : "file";
    const path = kind === "folder" ? rawPath.replace(/[\\/]+$/u, "") : rawPath;
    const name = path.split(/[\\/]/u).filter(Boolean).at(-1);
    if (!name) break;
    references.unshift({ kind, name, path });
    text = (match[1] ?? "").trimEnd();
  }

  return { text, references };
}

export function promptReferenceLabel(reference: PromptReferencePresentation): string {
  return reference.kind === "folder" ? `${reference.name}/` : reference.name;
}
