import { describe, expect, it } from "vitest";
import { toFeedDocumentProjection } from "../../src/frontend/feed-adapter";

describe("frontend feed adapter", () => {
  it("retains unchanged history projections when a streaming block changes", () => {
    const history = { type: "text" as const, id: "old", text: "Completed paragraph", phase: "complete" as const };
    const live = { type: "text" as const, id: "live", text: "A", phase: "streaming" as const };
    const before = toFeedDocumentProjection({ revision: 1, blocks: [history, live] });
    const after = toFeedDocumentProjection({ revision: 2, blocks: [history, { ...live, text: "AB" }] });
    expect(after.blocks[0]).toBe(before.blocks[0]);
    expect(after.blocks[1]).not.toBe(before.blocks[1]);
    expect(after.blocks[1]).toMatchObject({ text: "AB" });
  });
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
          {
            type: "attachment",
            name: "Attached image 1",
            kind: "image",
            data: "aGVsbG8=",
            mimeType: "image/png",
          },
        ],
      },
    });
  });

  it("preserves structured skill invocation metadata without adding it to prose", () => {
    const projection = toFeedDocumentProjection({
      revision: 4,
      blocks: [{
        type: "user",
        id: "user-skill",
        text: "Turn this into revision notes.",
        skillInvocations: [{ name: "study-notes" }],
      }],
    });

    expect(projection.blocks[0]).toMatchObject({
      type: "user",
      message: {
        content: "Turn this into revision notes.",
        skillInvocations: [{ name: "study-notes" }],
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

  it("preserves every canonical subagent message field without fabrication", () => {
    const message = {
      id: "message-1",
      runId: "run-1",
      nodeId: "node-1",
      threadId: "thread-1",
      from: { kind: "agent" as const, id: "actor-1", label: "Researcher" },
      to: [{ kind: "parent" as const, id: "main-1", label: "Main agent" }],
      kind: "request" as const,
      text: "Review this result",
      data: { resultId: "result-1", counts: [1, 2] },
      correlationId: "correlation-1",
      replyTo: "message-0",
      blocking: true,
      deadline: 1_000,
      status: "acknowledged" as const,
      createdAt: 100,
      acknowledgedAt: 200,
      response: {
        actor: { kind: "parent" as const, id: "main-1" },
        text: "Accepted",
        data: { accepted: true },
        createdAt: 300,
      },
    };

    const projection = toFeedDocumentProjection({
      revision: 5,
      blocks: [{ type: "message", id: "feed-message-1", message }],
    });

    expect(projection.blocks[0]).toEqual({
      type: "subagent-communication",
      id: "feed-message-1",
      messageId: "feed-message-1",
      message,
    });
  });
});
