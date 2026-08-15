import type { App } from "obsidian";
import { describe, expect, it } from "vitest";
import { gatherFileConventionFacts } from "../../src/prompt/environment";

function appWithConfig(values: Readonly<Record<string, unknown>>): App {
	return {
		vault: {
			getConfig: (key: string) => values[key],
		},
	} as unknown as App;
}

describe("Obsidian file convention environment facts", () => {
	it.each([
		["/", { mode: "vault-root" }],
		["./", { mode: "same-folder-as-source" }],
		["./assets", { mode: "subfolder-under-source", subfolderName: "assets" }],
		["Attachments/Images", { mode: "vault-folder", vaultRelativePath: "Attachments/Images" }],
	] as const)("normalizes attachment location %s", (attachmentFolderPath, expected) => {
		const observedAt = new Date("2026-08-13T12:00:00.000Z");
		const result = gatherFileConventionFacts(appWithConfig({
			useMarkdownLinks: false,
			newLinkFormat: "relative",
			attachmentFolderPath,
		}), observedAt);

		expect(result).toMatchObject({
			schemaVersion: 1,
			observationStatus: "exact",
			observedAt: observedAt.toISOString(),
			generatedLinks: { syntax: "wikilink", pathStyle: "relative" },
			newAttachments: expected,
		});
		expect(result.revision).toMatch(/^file-conventions-v1-[0-9a-f]{8}$/u);
	});

	it("publishes unavailable instead of guessing an unsupported setting shape", () => {
		const result = gatherFileConventionFacts(appWithConfig({
			useMarkdownLinks: false,
			newLinkFormat: "future-format",
			attachmentFolderPath: "./",
		}));

		expect(result).toMatchObject({ observationStatus: "unavailable", revision: "unavailable" });
		expect(result.generatedLinks).toBeUndefined();
		expect(result.newAttachments).toBeUndefined();
	});
});
