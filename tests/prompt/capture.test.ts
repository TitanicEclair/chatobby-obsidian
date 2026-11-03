import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockApp } from "../obsidian-bridge/helpers/mock-app";
import { gatherVaultContext, toPromptContextPacket } from "../../src/prompt";
import { disposeObsidianSemanticContextService, disposeObsidianUiSnapshotService, getObsidianSemanticContextService } from "../../src/obsidian-context";

const apps = new Set<App>();
afterEach(() => {
  vi.useRealTimers();
  for (const app of apps) {
    disposeObsidianUiSnapshotService(app);
    disposeObsidianSemanticContextService(app);
  }
  apps.clear();
});

function packet(app: App, sessionMessageCount = 0) {
  apps.add(app);
  return toPromptContextPacket(gatherVaultContext(app), { workingDirectory: "Notes", sessionMessageCount });
}

/** Exercise the production capture-to-packet path; grant admission is covered at submitAuthorizedPrompt.
 * @see docs/api/context.md
 */
describe("live prompt context capture", () => {
  it("keeps fresh UI capture time separate from event-cached semantic time", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T12:00:00.000Z"));
    const app = createMockApp(new Map([["Fixture.md", "Fixture"]]), { activeView: { path: "Fixture.md" } });
    const first = packet(app);
    vi.setSystemTime(new Date("2026-11-02T12:01:00.000Z"));
    const second = packet(app, 2);
    expect(second.appContext?.capturedAt).toBe(first.appContext?.capturedAt);
    expect(second.appContext?.inspection).toMatchObject({ capturedAt: "2026-11-02T12:01:00.000Z" });
    expect(second.appContext?.sequence).toBe(first.appContext?.sequence);
  });

  it("keeps every observed leaf while filling the prompt with distinct note references", async () => {
    const paths = Array.from({ length: 12 }, (_, index) => `Notes/Other-${index}.md`);
    const app = createMockApp(new Map([["Notes/Active.md", "Active"], ...paths.map((path): [string, string] => [path, path])]), {
      activeView: { path: "Notes/Active.md" },
    });
    const files = app.vault.getMarkdownFiles();
    const active = files.find((file) => file.path === "Notes/Active.md")!;
    for (let index = 0; index < 13; index += 1) await app.workspace.getLeaf("tab").openFile(active);
    for (const path of paths) await app.workspace.getLeaf("tab").openFile(files.find((file) => file.path === path)!);

    const context = packet(app);
    expect(context.openNotes?.map((note) => note.path)).toEqual(["Notes/Active.md", ...paths.slice(0, 11)]);
    expect(context.appContext?.workspace).toEqual({ leafCount: 26, openNoteCount: 26 });
    const workspace = getObsidianSemanticContextService(app).workspaceProjection();
    expect(workspace.leaves).toHaveLength(26);
    expect(workspace.openNotes).toHaveLength(26);
  });

  it("captures the unsaved editor excerpt, cursor and headings rather than saved note text", () => {
    const lines = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`);
    lines[0] = "# Title";
    lines[1] = "## Sub";
    const app = createMockApp(new Map([["Notes/Active.md", "Outdated saved text"]]), {
      activeView: { path: "Notes/Active.md", content: lines.join("\n"), cursor: { line: 20, ch: 0 }, selection: "" },
    });
    const note = packet(app).activeNote;

    expect(note?.path).toBe("Notes/Active.md");
    // Cursor line 20 is displayed as 21; twelve lines before and six after produce lines 9–27.
    expect(note?.excerpt).toMatchObject({ fromLine: 9, toLine: 27 });
    expect(note?.excerpt?.text).toContain("line 21");
    expect(note?.excerpt?.text).not.toContain("Outdated saved text");
    expect(note?.cursor).toEqual({ line: 21, ch: 0 });
    expect(note?.headings).toEqual(["Title", "Sub"]);
  });

  it("includes the current selection and marks it as included reference data", () => {
    const app = createMockApp(new Map([["Notes/Active.md", "Selected text"]]), {
      activeView: { path: "Notes/Active.md", selection: "Selected text" },
    });
    const context = packet(app);
    expect(context.activeNote?.selection).toBe("Selected text");
    expect(context.privacy.included).toContain("selection");
  });

  it("does not invent an active note when no Markdown view is open", () => {
    const context = packet(createMockApp(new Map(), {}));
    expect(context.activeNote).toBeUndefined();
    expect(context.privacy.included).not.toContain("active-note");
    expect(context.privacy.included).not.toContain("excerpt");
  });

  it("retains a complete reference packet on subsequent turns while reusing unchanged semantic capture", () => {
    const app = createMockApp(new Map([["Notes/Active.md", "Current text"]]), {
      activeView: { path: "Notes/Active.md", selection: "Current text" },
    });
    const initial = packet(app);
    const subsequent = packet(app, 2);
    expect(initial.workspace?.isNewSession).toBe(true);
    expect(subsequent.workspace).toMatchObject({ isNewSession: false, sessionMessageCount: 2 });
    expect(subsequent.activeNote).toEqual(initial.activeNote);
    expect(subsequent.openNotes).toEqual(initial.openNotes);
    expect(subsequent.capabilities).toEqual(initial.capabilities);
    const diagnostics = getObsidianSemanticContextService(app).diagnostics();
    expect(diagnostics.captures).toBe(1);
    expect(Number.isFinite(diagnostics.lastCaptureMs)).toBe(true);
    // Descriptive fixture evidence only; no timing threshold or installed-latency claim.
    console.info("M7 prompt capture diagnostics", JSON.stringify(diagnostics));
  });

  it("keeps prompt and explicit tool observations on the same snapshot revision", () => {
    const app = createMockApp(new Map([["Notes/Active.md", "Current text"]]), {
      activeView: { path: "Notes/Active.md", selection: "Current text" },
    });
    const context = packet(app);
    const service = getObsidianSemanticContextService(app);
    const tool = service.contextProjection();
    expect(tool).toMatchObject({
      contextId: context.appContext?.contextId,
      revisions: context.appContext?.revisions,
      activeNote: { path: context.activeNote?.path, excerpt: context.activeNote?.excerpt?.text },
      selection: { text: context.activeNote?.selection },
    });
    service.invalidate(["editor"]);
    expect(packet(app).appContext?.revisions.editor).toBe(2);
  });
});
