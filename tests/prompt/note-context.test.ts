import { describe, expect, it } from "vitest";
import { createMockApp } from "../obsidian-bridge/helpers/mock-app";
import { gatherNoteContext } from "../../src/prompt/note-context";

describe("gatherNoteContext", () => {
	it("builds a real excerpt around the cursor from the active note's live buffer", () => {
		const lines = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`);
		const content = lines.join("\n");
		const files = new Map([["Notes/Active.md", content]]);
		const cache = new Map([
			["Notes/Active.md", { headings: [{ heading: "Title", level: 1 }, { heading: "Sub", level: 2 }] }],
		]);
		const app = createMockApp(files, {
			activeView: { path: "Notes/Active.md", content, cursor: { line: 20, ch: 0 }, selection: "" },
			cache,
		});

		const ctx = gatherNoteContext(app);

		expect(ctx.notePath).toBe("Notes/Active.md");
		expect(ctx.contextExcerpt).toBeDefined();
		// cursor at 0-indexed line 20 (= "line 21"); 12 lines before, 6 after -> internal slice 8..26 -> 1-indexed 9..27
		expect(ctx.contextExcerpt?.fromLine).toBe(9);
		expect(ctx.contextExcerpt?.toLine).toBe(27);
		expect(ctx.contextExcerpt?.text).toContain("line 21");
		expect(ctx.contextExcerpt?.text.length).toBeGreaterThan(0);
		expect(ctx.cursor).toEqual({ line: 21, ch: 0 });
		expect(ctx.headings).toEqual(["Title", "Sub"]);
	});

	it("passes the current selection through", () => {
		const content = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join("\n");
		const app = createMockApp(new Map([["Notes/Active.md", content]]), {
			activeView: { path: "Notes/Active.md", content, cursor: { line: 5, ch: 0 }, selection: "line 6" },
		});

		const ctx = gatherNoteContext(app);

		expect(ctx.selection).toBe("line 6");
	});

	it("returns no excerpt when no markdown view is open", () => {
		const app = createMockApp(new Map(), {});
		const ctx = gatherNoteContext(app);

		expect(ctx.notePath).toBeUndefined();
		expect(ctx.contextExcerpt).toBeUndefined();
		expect(ctx.cursor).toBeUndefined();
	});
});
