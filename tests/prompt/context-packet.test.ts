import { describe, expect, it } from "vitest";
import { toPromptContextPacket } from "../../src/prompt";

describe("toPromptContextPacket", () => {
  it("routes only bounded Obsidian context and declares privacy omissions", () => {
    const packet = toPromptContextPacket({
      frontend: "obsidian",
      vault: "Work",
      environment: {
        time: {
          sentAtUtc: "2026-07-11T10:00:00Z",
          localDate: "2026-07-11",
          localTime: "18:00",
          utcOffsetMinutes: 480,
        },
        device: { platform: "Win32", userAgent: "fingerprint", hardwareConcurrency: 20 },
		fileConventions: {
			schemaVersion: 1,
			revision: "file-conventions-v1-test",
			observedAt: "2026-07-11T10:00:00Z",
			observationStatus: "exact",
			generatedLinks: { syntax: "wikilink", pathStyle: "relative" },
			newAttachments: { mode: "subfolder-under-source", subfolderName: "assets" },
		},
      },
      capabilities: {
        featureFamilies: ["vault"],
		integrations: [{ id: "webviewer", name: "Web Viewer", installed: true, enabled: false }],
        runtimeDependencies: [],
      },
      notePath: "Projects/Plan.md",
      selection: "Selected text",
      contextExcerpt: { fromLine: 4, toLine: 12, text: "Bounded excerpt" },
      openNotes: [{ path: "Projects/Plan.md", title: "Plan" }],
    }, {
      workingDirectory: "Projects",
      sessionMessageCount: 0,
      sessionName: "Plan review",
    });

    expect(packet).toMatchObject({
      schemaVersion: 2,
      source: "obsidian",
      vault: "Work",
      workspace: {
        workingDirectory: "Projects",
        activeSurface: "note",
        isNewSession: true,
        sessionMessageCount: 0,
        sessionName: "Plan review",
      },
      activeNote: { path: "Projects/Plan.md", selection: "Selected text" },
      capabilities: {
        featureFamilies: ["vault"],
		integrations: [{ id: "webviewer", installed: true, enabled: false }],
        runtimeDependencies: [],
      },
      privacy: { included: ["workspace", "environment", "capabilities", "active-note", "selection", "excerpt", "open-notes"] },
    });
    expect(packet.environment?.device).toEqual({ platform: "Win32" });
	expect(packet.environment?.fileConventions).toMatchObject({
		generatedLinks: { syntax: "wikilink", pathStyle: "relative" },
		newAttachments: { mode: "subfolder-under-source", subfolderName: "assets" },
	});
    expect(packet.privacy.omitted).toContain("device fingerprint");
    expect(packet.privacy.omitted).toContain("unrelated plugin inventory");
  });

  it("routes established vault-level sessions without inventing note context", () => {
    const packet = toPromptContextPacket({ frontend: "obsidian", vault: "Work" }, {
      workingDirectory: "",
      sessionMessageCount: 4,
    });

    expect(packet.workspace).toEqual({
      workingDirectory: ".",
      activeSurface: "vault",
      isNewSession: false,
      sessionMessageCount: 4,
      sessionName: undefined,
    });
    expect(packet.activeNote).toBeUndefined();
  });

  it("enforces prompt budgets and excludes unrelated plugin inventory at the packet boundary", () => {
    const packet = toPromptContextPacket({
      frontend: "obsidian",
      vault: "Work",
      capabilities: {
        featureFamilies: ["vault", "browser"],
        integrations: [
          { id: "webviewer", name: "Web viewer", installed: true, enabled: true },
          { id: "unrelated-plugin", name: "Unrelated", installed: true, enabled: true },
        ],
        runtimeDependencies: [],
      },
      notePath: "Large.md",
      selection: "s".repeat(15_000),
      headings: Array.from({ length: 80 }, (_, index) => `Heading ${index} ${"h".repeat(250)}`),
      openNotes: Array.from({ length: 20 }, (_, index) => ({
        path: `Note ${index}.md`,
        title: `Note ${index}`,
      })),
    });

    expect(packet.activeNote?.selection).toHaveLength(12_000);
    expect(packet.activeNote).toMatchObject({
      selectionCharacters: 15_000,
      selectionTruncated: true,
      headingCount: 80,
      headingsTruncated: true,
    });
    expect(packet.activeNote?.headings).toHaveLength(64);
    expect(packet.activeNote?.headings?.every((heading) => heading.length <= 200)).toBe(true);
    expect(packet.openNotes).toHaveLength(12);
    expect(packet.capabilities?.integrations.map((integration) => integration.id)).toEqual(["webviewer"]);
    expect(JSON.stringify(packet).length).toBeLessThan(30_000);
  });
});
