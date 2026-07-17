import { describe, expect, it } from "vitest";
import { toFeedDocumentProjection } from "../../src/frontend/feed-adapter";

describe("frontend feed adapter", () => {
  it("preserves runtime-projected tool semantics and phases", () => {
    const projection = toFeedDocumentProjection({
      revision: 1,
      blocks: [{
        type: "tools",
        id: "tools-1",
        phase: "streaming",
        items: [{
          id: "call-1",
          semanticKind: "agents.inspect",
          category: "subagent",
          phase: "running",
          title: "inspecting agents",
          detail: "{}",
          iconToken: "bot",
          expandable: true,
        }],
      }],
    });

    expect(projection.blocks[0]).toMatchObject({
      type: "tools",
      items: [{
        name: "agents.inspect",
        semanticKind: "agents.inspect",
        displayTitle: "inspecting agents",
        category: "subagent",
        status: "running",
      }],
    });
  });

  it("preserves the compact runtime turn summary and its expandable trace", () => {
    const projection = toFeedDocumentProjection({
      revision: 2,
      blocks: [{
        type: "summary",
        id: "summary:turn-1",
        text: "Thought for 8s · read 4 files · called 3 tools",
        durationMs: 8_000,
        toolCounts: { "files.read": 4, "tool.other": 3 },
        blocks: [{
          type: "thinking",
          id: "thinking-1",
          turnId: "turn-1",
          text: "Inspect the project.",
          phase: "complete",
          durationMs: 8_000,
        }],
      }],
    });

    expect(projection.blocks[0]).toMatchObject({
      type: "summary",
      text: "Thought for 8s · read 4 files · called 3 tools",
      durationMs: 8_000,
      toolCounts: { "files.read": 4, "tool.other": 3 },
      isExpanded: false,
      blocks: [{ type: "thinking", text: "Inspect the project.", durationMs: 8_000 }],
    });
  });

  it("preserves pasted images as renderable user-message content", () => {
    const projection = toFeedDocumentProjection({
      revision: 3,
      blocks: [{
        type: "user",
        id: "user-image",
        text: "What is shown here?",
        images: [{ data: "aGVsbG8=", mimeType: "image/png" }],
      }],
    });

    expect(projection.blocks[0]).toMatchObject({
      type: "user",
      message: {
        content: [
          { type: "text", text: "What is shown here?" },
          { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
        ],
      },
    });
  });

  it("maps runtime agent activity to the navigable supervisor source", () => {
    const projection = toFeedDocumentProjection({
      revision: 4,
      blocks: [{
        type: "agent-activity",
        id: "subagent-run:run-1",
        actorId: "run-1",
        title: "Explorer",
        phase: "completed",
        detail: "Read the requested files.",
      }],
    });

    expect(projection.blocks[0]).toMatchObject({
      type: "subagent",
      agentId: "run-1",
      activity: {
        agentId: "run-1",
        source: "chatobby-supervisor",
        status: "completed",
      },
    });
  });
});
