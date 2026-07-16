import type { ImageContent, UserMessage } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { decorateAfterMarkdown } from "./decorations";
import type { FeedHost } from "./index";

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
      this.renderMarkdown(content, this.contentEl);
      return;
    }
    for (const item of content) {
      if (item.type === "text") {
        this.renderMarkdown(item.text, this.contentEl.createDiv({ cls: "chatobby-user-block__text" }));
      } else if (item.type === "image") {
        renderImageCard(this.contentEl, item, this.host);
      }
    }
  }

  private renderMarkdown(markdown: string, container: HTMLElement): void {
    const rendered = this.host.renderMarkdown(markdown, container);
    decorateAfterMarkdown(container, rendered, {
      openVaultLink: (path) => this.host.openVaultLink(path),
      openSystemPath: (path) => this.host.openSystemPath(path),
    });
  }
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
