import { setIcon } from "obsidian";
import type { AttachmentContent } from "../../types";
import { attachmentMeta, attachmentVisual } from "../attachments/attachment-presentation";
import type { FeedHost } from "./index";

export function renderMessageAttachments(
  container: HTMLElement,
  attachments: readonly AttachmentContent[],
  host: FeedHost,
): void {
  if (attachments.length === 0) return;
  const rail = container.createDiv({ cls: "chatobby-message-attachments" });
  for (const attachment of attachments) renderAttachmentCard(rail, attachment, host);
}

function renderAttachmentCard(container: HTMLElement, attachment: AttachmentContent, host: FeedHost): void {
  const card = container.createEl("button", {
    cls: "chatobby-message-attachment",
    attr: {
      type: "button",
      title: attachment.path ? `Show ${attachment.name} in folder` : attachment.name,
      "aria-label": attachment.path ? `Show ${attachment.name} in folder` : attachment.name,
    },
  });
  const visual = attachmentVisual(
    attachment.name,
    attachment.kind === "image" ? "image" : attachment.kind === "text" ? "text" : "file",
  );
  card.dataset.fileKind = visual.kind;
  const source = attachment.data && attachment.kind === "image"
    ? imageSource(attachment.data, attachment.mimeType)
    : undefined;
  if (source) {
    card.createEl("img", {
      cls: "chatobby-message-attachment__thumb",
      attr: { src: source, alt: attachment.name },
    });
  } else {
    const icon = card.createSpan({ cls: "chatobby-message-attachment__icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, visual.icon);
  }
  const body = card.createDiv({ cls: "chatobby-message-attachment__body" });
  body.createDiv({ cls: "chatobby-message-attachment__name", text: attachment.name });
  body.createDiv({
    cls: "chatobby-message-attachment__meta",
    text: attachmentMeta(attachment.name, attachment.kind === "binary" ? "File" : attachment.kind, attachment.sizeBytes),
  });
  card.addEventListener("click", () => {
    if (attachment.path) host.revealSystemPath(attachment.path);
    else if (source) window.open(source, "_blank");
  });
}

function imageSource(data: string, mimeType = "image/png"): string {
  return data.startsWith("data:") ? data : `data:${mimeType};base64,${data}`;
}
