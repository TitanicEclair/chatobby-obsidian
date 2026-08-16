import { setIcon } from "obsidian";
import type { AttachmentContent, ImageContent, UserMessage } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { decorateAfterMarkdown } from "./decorations";
import type { FeedHost } from "./index";
import { renderMessageAttachments } from "./message-attachments";
import {
  parsePromptReferences,
  promptReferenceLabel,
  type PromptReferencePresentation,
} from "../shared/prompt-references";

export class UserBlockView extends ChatobbyComponent {
  private contentEl: HTMLElement | null = null;

  constructor(private readonly host: FeedHost) {
    super();
  }

  setMessage(message: UserMessage, variant: "user" | "system"): void {
    this.container?.toggleClass("is-system", variant === "system");
    if (!this.contentEl) return;
    this.contentEl.empty();
    this.renderMessageContent(message);
  }

  protected onRender(container: HTMLElement): void {
    this.contentEl = container.createDiv({ cls: "chatobby-user-block__content" });
  }

  protected componentClass(): string {
    return "chatobby-user-block";
  }

  private renderMessageContent(message: UserMessage): void {
    if (!this.contentEl) return;
    const content = message.content;
    if (typeof content === "string") {
      const parsed = parsePromptReferences(content);
      if (parsed.text) this.renderMarkdown(parsed.text, this.contentEl);
      renderReferenceSummary(this.contentEl, parsed.references);
      renderSkillInvocations(this.contentEl, message.skillInvocations ?? []);
      return;
    }
    const attachments: AttachmentContent[] = [];
    const references: PromptReferencePresentation[] = [];
    for (const item of content) {
      if (item.type === "text") {
        const parsed = parsePromptReferences(item.text);
        if (parsed.text) this.renderMarkdown(parsed.text, this.contentEl.createDiv({ cls: "chatobby-user-block__text" }));
        references.push(...parsed.references);
      } else if (item.type === "image") {
        renderImageCard(this.contentEl, item, this.host);
      } else if (item.type === "attachment") {
        attachments.push(item);
      }
    }
    renderReferenceSummary(this.contentEl, references);
    renderSkillInvocations(this.contentEl, message.skillInvocations ?? []);
    renderMessageAttachments(this.contentEl, attachments, this.host);
  }

  private renderMarkdown(markdown: string, container: HTMLElement): void {
    const rendered = this.host.renderMarkdown(markdown, container);
    decorateAfterMarkdown(container, rendered, {
      openVaultLink: (path) => this.host.openVaultLink(path),
      openSystemPath: (path) => this.host.openSystemPath(path),
    });
  }
}

function renderSkillInvocations(
  container: HTMLElement,
  skills: readonly { readonly name: string }[],
): void {
  const unique = skills.filter((skill, index) => skills.findIndex((candidate) => candidate.name === skill.name) === index);
  for (const skill of unique) {
    const chip = container.createDiv({
      cls: "chatobby-message-reference-summary chatobby-message-skill-invocation",
      attr: { "aria-label": `Invoked skill ${skill.name}`, title: `Skill: ${skill.name}` },
    });
    const icon = chip.createSpan({ cls: "chatobby-message-skill-invocation__icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, "sparkles");
    chip.createSpan({ cls: "chatobby-message-reference-summary__label", text: skill.name });
  }
}

function renderReferenceSummary(
  container: HTMLElement,
  references: readonly PromptReferencePresentation[],
): void {
  if (references.length === 0) return;
  const unique = references.filter((reference, index) =>
    references.findIndex((candidate) => candidate.kind === reference.kind && candidate.path === reference.path) === index);
  const chip = container.createDiv({
    cls: "chatobby-message-reference-summary",
    attr: {
      title: unique.map((reference) => reference.path).join("\n"),
      "aria-label": unique.length === 1
        ? `Referenced ${promptReferenceLabel(unique[0]!)}`
        : `${unique.length} referenced items`,
    },
  });
  chip.createSpan({ cls: "chatobby-message-reference-summary__at", text: "@", attr: { "aria-hidden": "true" } });
  chip.createSpan({
    cls: "chatobby-message-reference-summary__label",
    text: unique.length === 1 ? promptReferenceLabel(unique[0]!) : `${unique.length} references`,
  });
}

function renderImageCard(container: HTMLElement, image: ImageContent, host: FeedHost): void {
  const src = imageSource(image);
  const card = container.createDiv({ cls: "chatobby-media-card" });
  card.createEl("img", {
    cls: "chatobby-media-card__image",
    attr: { src, alt: `Attached ${image.mimeType || "image"}` },
  });
  const meta = card.createDiv({ cls: "chatobby-media-card__meta" });
  meta.createSpan({ cls: "chatobby-media-card__label", text: image.mimeType || "image" });
  const actions = meta.createDiv({ cls: "chatobby-media-card__actions" });
  const copy = actions.createEl("button", {
    cls: "chatobby-media-card__action",
    attr: { type: "button", title: "Copy image data URL" },
    text: "Copy",
  });
  copy.addEventListener("click", () => host.copyToClipboard(src));
  const open = actions.createEl("button", {
    cls: "chatobby-media-card__action",
    attr: { type: "button", title: "Open image" },
    text: "Open",
  });
  open.addEventListener("click", () => window.open(src, "_blank"));
}

function imageSource(image: ImageContent): string {
  if (image.data.startsWith("data:")) return image.data;
  return `data:${image.mimeType || "image/png"};base64,${image.data}`;
}
