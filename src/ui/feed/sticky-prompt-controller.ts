import type { FeedBlock, UserMessage } from "../../types";

interface StickyPromptControllerOptions {
	readonly getScroll: () => HTMLElement | null;
	readonly getOrderedBlocks: () => readonly FeedBlock[];
	readonly getBlockElement: (blockId: string) => HTMLElement | null;
	readonly beforeNavigate?: () => void;
}

/** Maintains one compact pointer to the prompt governing the visible response. */
export class StickyPromptController {
	private button: HTMLButtonElement | null = null;
	private text: HTMLSpanElement | null = null;
	private highlighted: HTMLElement | null = null;
	private highlightTimer: number | null = null;

	constructor(private readonly options: StickyPromptControllerOptions) {}

	mount(container: HTMLElement): void {
		this.button = container.createEl("button", {
			cls: "chatobby-feed__sticky-prompt is-hidden",
			attr: { type: "button", "aria-label": "Return to the preceding prompt" },
		});
		this.text = this.button.createSpan({ cls: "chatobby-feed__sticky-prompt-text" });
		this.button.addEventListener("click", () => this.open());
	}

	update(readingMode: boolean): void {
		const button = this.button;
		const scroll = this.options.getScroll();
		if (!button || !scroll || !readingMode) {
			button?.addClass("is-hidden");
			return;
		}
		const threshold = scroll.getBoundingClientRect().top;
		let candidate: FeedBlock | null = null;
		for (const block of this.options.getOrderedBlocks()) {
			if (block.type !== "user") continue;
			const element = this.options.getBlockElement(block.id);
			// Once its opening line scrolls away, this prompt governs the visible response,
			// even when the tail of its bubble is still clipped at the viewport edge.
			if (!element || element.getBoundingClientRect().top >= threshold) break;
			candidate = block;
		}
		const label = candidate?.type === "user" ? promptLabel(candidate.message.content) : "";
		button.toggleClass("is-hidden", !candidate || !label);
		if (this.text?.textContent !== label && this.text) this.text.textContent = label;
		button.dataset.targetBlockId = candidate?.id ?? "";
		button.setAttr("aria-label", label ? `Return to prompt: ${label}` : "Return to the preceding prompt");
	}

	clear(): void {
		if (this.highlightTimer !== null) window.clearTimeout(this.highlightTimer);
		this.highlightTimer = null;
		this.highlighted?.removeClass("is-feed-target");
		this.highlighted = null;
		this.button = null;
		this.text = null;
	}

	private open(): void {
		const id = this.button?.dataset.targetBlockId;
		const element = id ? this.options.getBlockElement(id) : null;
		if (!element) return;
		this.options.beforeNavigate?.();
		element.scrollIntoView({ behavior: "smooth", block: "center" });
		this.highlighted?.removeClass("is-feed-target");
		if (this.highlightTimer !== null) window.clearTimeout(this.highlightTimer);
		this.highlighted = element;
		element.addClass("is-feed-target");
		this.highlightTimer = window.setTimeout(() => {
			element.removeClass("is-feed-target");
			if (this.highlighted === element) this.highlighted = null;
			this.highlightTimer = null;
		}, 1_000);
	}
}

function promptLabel(content: UserMessage["content"]): string {
	const text = typeof content === "string"
		? content
		: content.flatMap((part) => part.type === "text" ? [part.text] : []).join(" ");
	return text.replaceAll(/\s+/gu, " ").trim() || (typeof content !== "string" && content.length > 0 ? "Attached files" : "");
}
