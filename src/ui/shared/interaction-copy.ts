export interface InteractionCopy {
  readonly title: string;
  readonly message: string;
}

/** Split the extension UI's compact `title\nmessage` convention into stable display fields. */
export function interactionCopy(
  params: Readonly<Record<string, unknown>>,
  fallbackTitle: string,
): InteractionCopy {
  const rawTitle = typeof params.title === "string" ? params.title.trim() : "";
  const [firstLine, ...remainingLines] = rawTitle.split(/\r?\n/u);
  const explicitMessage = typeof params.message === "string" ? params.message.trim() : "";
  return {
    title: firstLine?.trim() || fallbackTitle,
    message: explicitMessage || remainingLines.join("\n").trim(),
  };
}
