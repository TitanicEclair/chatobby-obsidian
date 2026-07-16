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
      },
      capabilities: {
        featureFamilies: ["vault", "cli"],
        integrations: [{ id: "daily-notes", name: "Daily notes", installed: true, enabled: false }],
        runtimeDependencies: [{ id: "obsidian-cli", name: "Obsidian CLI", available: false }],
      },
      notePath: "Projects/Plan.md",
      selection: "Selected text",
      contextExcerpt: { fromLine: 4, toLine: 12, text: "Bounded excerpt" },
      openNotes: [{ path: "Projects/Plan.md", title: "Plan" }],
    }, {
      workingDirectory: "Projects",
      sessionMessageCount: 0,
      sessionName: "Plan review",
      permissionMode: "default",
    });

    expect(packet).toMatchObject({
      schemaVersion: 1,
      source: "obsidian",
      vault: "Work",
      workspace: {
        workingDirectory: "Projects",
        activeSurface: "note",
        isNewSession: true,
        sessionMessageCount: 0,
        sessionName: "Plan review",
        permissionMode: "default",
      },
      activeNote: { path: "Projects/Plan.md", selection: "Selected text" },
      capabilities: {
        featureFamilies: ["vault", "cli"],
        integrations: [{ id: "daily-notes", installed: true, enabled: false }],
        runtimeDependencies: [{ id: "obsidian-cli", available: false }],
      },
      privacy: { included: ["workspace", "environment", "capabilities", "active-note", "selection", "excerpt", "open-notes"] },
    });
    expect(packet.environment?.device).toEqual({ platform: "Win32" });
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
      permissionMode: undefined,
    });
    expect(packet.activeNote).toBeUndefined();
  });
});
