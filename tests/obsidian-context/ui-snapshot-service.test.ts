import { afterEach, describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import {
  disposeObsidianSemanticContextService,
  disposeObsidianUiSnapshotService,
  ObsidianUiSnapshotService,
} from "../../src/obsidian-context";
import { BridgeError } from "../../src/obsidian-bridge/types";
import { createMockApp } from "../obsidian-bridge/helpers/mock-app";

const apps: App[] = [];

function appWithUi(root: HTMLElement): App {
  document.body.appendChild(root);
  const app = createMockApp(new Map([["Active.md", "# Active"]]), {
    activeView: { path: "Active.md" },
  });
  const leaf = (app.workspace as unknown as {
    activeLeaf?: {
      view?: {
        contentEl?: HTMLElement;
        getViewType?(): string;
        getDisplayText?(): string;
      };
    };
  }).activeLeaf;
  if (!leaf?.view) throw new Error("Expected active mock leaf");
  leaf.view.contentEl = root;
  leaf.view.getViewType = () => "markdown";
  leaf.view.getDisplayText = () => "Active";
  apps.push(app);
  return app;
}

afterEach(() => {
  document.body.replaceChildren();
  for (const app of apps.splice(0)) {
    disposeObsidianUiSnapshotService(app);
    disposeObsidianSemanticContextService(app);
  }
  vi.restoreAllMocks();
});

describe("ObsidianUiSnapshotService", () => {
  it("captures typed accessible state, focus/caret, and opaque paging", () => {
    const root = document.createElement("main");
    const input = document.createElement("input");
    input.type = "text";
    input.setAttribute("aria-label", "Search notes");
    input.value = "query";
    root.appendChild(input);
    for (let index = 0; index < 5; index += 1) {
      const button = document.createElement("button");
      button.textContent = `Action ${index + 1}`;
      root.appendChild(button);
    }
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Advanced";
		details.appendChild(summary);
		root.appendChild(details);
		const app = appWithUi(root);
		input.focus();
		input.setSelectionRange(1, 4, "forward");

		const service = new ObsidianUiSnapshotService(app);
    const first = service.snapshot({ limit: 3 });

    expect(first.schemaVersion).toBe(1);
    expect(first.coverage).toMatchObject({ kind: "visible_item_view", exact: true });
    expect(first.page).toMatchObject({ returned: 3, truncated: true });
    expect(first.page.nextCursor).toMatch(/^cur_/u);
    expect(first.documentRevision).toMatch(/^\d+\./u);
    expect(first.focus).toMatchObject({
      role: "textbox",
      name: "Search notes",
      caret: { start: 1, end: 4, direction: "forward" },
    });
    expect(first.nodes[0]).toMatchObject({
      role: "main",
      tag: "main",
      state: {},
    });

    const second = service.snapshot({ cursor: first.page.nextCursor, limit: 20 });
    expect(second.documentId).toBe(first.documentId);
    expect(second.documentRevision).toBe(first.documentRevision);
    expect(second.nodes.some((node) => node.name === "Advanced" && node.role === "button")).toBe(true);
    expect(second.nodes.some((node) => node.role === "group" && node.state.expanded === false)).toBe(true);
    expect(new Set([...first.nodes, ...second.nodes].map((node) => node.ref)).size)
      .toBe(first.nodes.length + second.nodes.length);
  });

  it("performs a current interaction, invalidates all old refs, and requires verification", () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    button.textContent = "Run";
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    root.appendChild(button);
    const service = new ObsidianUiSnapshotService(appWithUi(root));
    const snapshot = service.snapshot({});
    const node = snapshot.nodes.find((entry) => entry.name === "Run");
    expect(node).toBeDefined();

    const result = service.interact({
      ref: node!.ref,
      documentRevision: snapshot.documentRevision,
      action: "click",
    });

    expect(onClick).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      performed: true,
      action: "click",
      ref: node!.ref,
      documentId: snapshot.documentId,
      refreshRequired: true,
    });
    expect(() => service.interact({
      ref: node!.ref,
      documentRevision: snapshot.documentRevision,
      action: "click",
    })).toThrowError(expect.objectContaining({ code: "RESULT_EXPIRED" }));
  });

	it("rejects an interaction when the visible DOM changed after capture", () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    button.textContent = "Original";
    root.appendChild(button);
    const service = new ObsidianUiSnapshotService(appWithUi(root));
    const snapshot = service.snapshot({});
    const node = snapshot.nodes.find((entry) => entry.role === "button");
    button.textContent = "Changed";

		expect(() => service.interact({
			ref: node!.ref,
			documentRevision: snapshot.documentRevision,
			action: "click",
		})).toThrowError(expect.objectContaining({ code: "REVISION_CONFLICT" }));
	});

	it("excludes collapsed descendants and redacts sensitive field values", () => {
		const root = document.createElement("div");
		const password = document.createElement("input");
		password.type = "password";
		password.setAttribute("aria-label", "Access token");
		password.value = "secret";
		root.appendChild(password);
		const oneTimeCode = document.createElement("input");
		oneTimeCode.type = "text";
		oneTimeCode.autocomplete = "one-time-code";
		oneTimeCode.setAttribute("aria-label", "Verification code");
		oneTimeCode.value = "123456";
		root.appendChild(oneTimeCode);
		const details = document.createElement("details");
		const summary = document.createElement("summary");
		summary.textContent = "More";
		const hiddenButton = document.createElement("button");
		hiddenButton.textContent = "Hidden action";
		details.append(summary, hiddenButton);
		root.appendChild(details);

		const result = new ObsidianUiSnapshotService(appWithUi(root)).snapshot({});
		const passwordNode = result.nodes.find((node) => node.name === "Access token");
		expect(passwordNode).toMatchObject({ state: { valueRedacted: true } });
		expect(passwordNode).not.toHaveProperty("value");
		const oneTimeCodeNode = result.nodes.find((node) => node.name === "Verification code");
		expect(oneTimeCodeNode).toMatchObject({ state: { valueRedacted: true } });
		expect(oneTimeCodeNode).not.toHaveProperty("value");
		expect(result.nodes.some((node) => node.name === "Hidden action")).toBe(false);
		expect(result.nodes.some((node) => node.name === "More")).toBe(true);
	});

	it("treats leafId as an active-view assertion rather than a hidden-leaf selector", () => {
		const root = document.createElement("main");
		const service = new ObsidianUiSnapshotService(appWithUi(root));
		expect(() => service.snapshot({ leafId: "different-leaf" }))
			.toThrowError(expect.objectContaining({ code: "REVISION_CONFLICT" }));
	});

  it("expires cursors without implying the view is empty", () => {
    let now = 1_000;
    const root = document.createElement("div");
    for (let index = 0; index < 4; index += 1) {
      const button = document.createElement("button");
      button.textContent = `Button ${index}`;
      root.appendChild(button);
    }
    const service = new ObsidianUiSnapshotService(appWithUi(root), () => now);
    const snapshot = service.snapshot({ limit: 1 });
    expect(snapshot.page.nextCursor).toBeDefined();
    now += 5 * 60_000 + 1;

    try {
      service.snapshot({ cursor: snapshot.page.nextCursor });
      throw new Error("Expected cursor expiry");
    } catch (error) {
      expect(error).toBeInstanceOf(BridgeError);
      expect(error).toMatchObject({ code: "RESULT_EXPIRED" });
    }
  });

	it("returns an explicit warning when an ItemView has no inspectable content root", () => {
    const app = createMockApp(new Map([["Active.md", "# Active"]]), {
      activeView: { path: "Active.md" },
    });
    apps.push(app);
    const result = new ObsidianUiSnapshotService(app).snapshot({});
    expect(result.nodes).toEqual([]);
    expect(result.page).toMatchObject({ returned: 0, total: 0, truncated: false });
    expect(result.warnings[0]).toContain("does not expose");
  });

  it("reports bounded traversal diagnostics and computes visibility once per element", () => {
    const root = document.createElement("main");
    for (const name of ["One", "Two"]) {
      const button = document.createElement("button");
      button.textContent = name;
      root.appendChild(button);
    }
    const computedStyle = vi.spyOn(window, "getComputedStyle");
    let measurement = 0;
    const service = new ObsidianUiSnapshotService(
      appWithUi(root),
      () => 1_000,
      () => {
        measurement += 3;
        return measurement;
      },
    );

    service.snapshot({});

    expect(service.diagnostics()).toEqual({
      snapshots: 1,
      interactions: 0,
      treeCaptures: 1,
      scannedElements: 3,
      semanticNodes: 3,
      lastTraversalMs: 3,
      maxTraversalMs: 3,
    });
    expect(computedStyle.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
