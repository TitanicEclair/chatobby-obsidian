import { describe, expect, it, vi } from "vitest";
import type { FeedStore } from "../../src/features/feed/public";
import type { ChatobbyTransport } from "../../src/transport/ws-client";
import {
  retractAcceptedPrompt,
  submitPrompt,
} from "../../src/ui/controller/prompt-submission-controller";

type PromptTransport = Pick<ChatobbyTransport, "isConnected" | "prompt" | "retractPrompt">;
type PromptFeedStore = Pick<FeedStore, "dispatch">;

function feedStore(): PromptFeedStore {
  return { dispatch: vi.fn() };
}

function transport(overrides: Partial<PromptTransport> = {}): PromptTransport {
  return {
    isConnected: true,
    prompt: vi.fn(async () => "started" as const),
    retractPrompt: vi.fn(async () => ({ retracted: true as const })),
    ...overrides,
  };
}

describe("prompt submission controller", () => {
  it("submits a correlated feed message and leaves an accepted prompt in place", async () => {
    const feed = feedStore();
    const client = transport();

    await expect(submitPrompt({
      transport: client,
      feedStore: feed,
      message: "hello",
      submissionId: "submission-1",
    })).resolves.toBeUndefined();

    expect(client.prompt).toHaveBeenCalledWith("hello", undefined, undefined, "submission-1");
    expect(feed.dispatch).toHaveBeenCalledOnce();
    expect(feed.dispatch).toHaveBeenCalledWith({
      type: "feed.user-prompt-submitted",
      text: "hello",
      startRun: true,
      submissionId: "submission-1",
    });
  });

  it("removes the exact feed message when the backend retracts before starting", async () => {
    const feed = feedStore();
    const client = transport({ prompt: vi.fn(async () => "retracted" as const) });

    await expect(submitPrompt({
      transport: client,
      feedStore: feed,
      message: "pull this back",
      submissionId: "submission-2",
    })).resolves.toEqual({ retracted: true });

    expect(client.retractPrompt).not.toHaveBeenCalled();
    expect(feed.dispatch).toHaveBeenLastCalledWith({
      type: "feed.user-prompt-retracted",
      submissionId: "submission-2",
      text: "pull this back",
    });
  });

  it("asks the backend to retract when Escape races with prompt acceptance", async () => {
    const feed = feedStore();
    const controller = new AbortController();
    let acceptPrompt: ((status: "started") => void) | undefined;
    const client = transport({
      prompt: vi.fn(() => new Promise<"started">((resolve) => {
        acceptPrompt = resolve;
      })),
    });
    const submission = submitPrompt({
      transport: client,
      feedStore: feed,
      message: "race",
      signal: controller.signal,
      submissionId: "submission-3",
    });

    expect(client.prompt).toHaveBeenCalledWith("race", undefined, undefined, "submission-3");
    controller.abort();
    acceptPrompt?.("started");

    await expect(submission).resolves.toEqual({ retracted: true });

    expect(client.retractPrompt).toHaveBeenCalledWith("submission-3");
    expect(feed.dispatch).toHaveBeenLastCalledWith({
      type: "feed.user-prompt-retracted",
      submissionId: "submission-3",
      text: "race",
    });
  });

  it("does not remove an accepted message after visible output has started", async () => {
    const feed = feedStore();
    const client = transport({
      retractPrompt: vi.fn(async () => ({ retracted: false as const, reason: "output-started" as const })),
    });

    await expect(retractAcceptedPrompt(client, feed, "submission-4", "keep this"))
      .resolves.toEqual({ retracted: false, reason: "output-started" });
    expect(feed.dispatch).not.toHaveBeenCalled();
  });
});
