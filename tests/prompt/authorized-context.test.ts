import { describe, expect, it, vi } from "vitest";
import { gatherAuthorizedPromptContext } from "../../src/prompt/authorized-context";
import type { WsPromptContextPacket } from "../../src/vendor/chatobby-client/connector-types.js";

type Stamp = NonNullable<WsPromptContextPacket["obsidianVaultAccess"]>;
const stamp: Stamp = { sessionId: "session-a", vaultId: "vault-a", bindingRevision: 3, policyRevision: 7 };
const packet: WsPromptContextPacket = {
  schemaVersion: 2, source: "obsidian", vault: "SYNTHETIC_PASSIVE_VAULT",
  activeNote: { path: "SYNTHETIC_PASSIVE.md", selection: "SYNTHETIC_SELECTION" },
  privacy: { included: ["active-note", "selection"], omitted: [] },
};

function fixture() {
  const readStamp = vi.fn<() => Promise<Stamp | undefined>>(async () => ({ ...stamp }));
  const gather = vi.fn(() => packet);
  const isCurrentTarget = vi.fn(() => true);
  return { sessionId: "session-a", readStamp, gather, isCurrentTarget };
}

describe("authorized passive prompt collection", () => {
  it("does not collect anything when authenticated eligibility is absent", async () => {
    const options = fixture();
    options.readStamp.mockResolvedValue(undefined);
    expect(await gatherAuthorizedPromptContext(options)).toBeUndefined();
    expect(options.gather).not.toHaveBeenCalled();
    expect(options.readStamp).toHaveBeenCalledOnce();
  });

  it("collects only after the first host read and stamps only after the matching recheck", async () => {
    const options = fixture();
    options.gather.mockImplementation(() => {
      expect(options.readStamp).toHaveBeenCalledOnce();
      return packet;
    });
    expect(await gatherAuthorizedPromptContext(options)).toEqual({ ...packet, obsidianVaultAccess: stamp });
    expect(options.readStamp).toHaveBeenCalledTimes(2);
    expect(options.gather).toHaveBeenCalledOnce();
    expect(packet).not.toHaveProperty("obsidianVaultAccess");
  });

  it.each([
    undefined,
    { ...stamp, sessionId: "session-b" },
    { ...stamp, vaultId: "vault-b" },
    { ...stamp, bindingRevision: 4 },
    { ...stamp, policyRevision: 8 },
  ].map((latest) => ({ latest })))("drops a packet when authorization is revoked or changed after collection: $latest", async ({ latest }) => {
    const options = fixture();
    options.readStamp.mockResolvedValueOnce(stamp).mockResolvedValueOnce(latest);
    expect(await gatherAuthorizedPromptContext(options)).toBeUndefined();
    expect(options.gather).toHaveBeenCalledOnce();
  });

  it("rejects another session's initial stamp before gathering", async () => {
    const options = fixture();
    options.readStamp.mockResolvedValue({ ...stamp, sessionId: "session-b" });
    await expect(gatherAuthorizedPromptContext(options)).rejects.toThrow(/does not belong/);
    expect(options.gather).not.toHaveBeenCalled();
  });

  it.each(["before", "first-read", "recheck"] as const)("rejects a changed leaf/session/transport target at %s", async (stage) => {
    const options = fixture();
    if (stage === "before") options.isCurrentTarget.mockReturnValue(false);
    else options.readStamp.mockImplementation(async () => {
      if (stage === "first-read" || options.readStamp.mock.calls.length === 2) options.isCurrentTarget.mockReturnValue(false);
      return stamp;
    });
    await expect(gatherAuthorizedPromptContext(options)).rejects.toThrow(/active chat changed/);
    expect(options.gather).toHaveBeenCalledTimes(stage === "recheck" ? 1 : 0);
  });

  it.each(["before", "first-read", "recheck"] as const)("does not return passive data after cancellation at %s", async (stage) => {
    const options = fixture();
    const abort = new AbortController();
    if (stage === "before") abort.abort();
    else options.readStamp.mockImplementation(async () => {
      if (stage === "first-read" || options.readStamp.mock.calls.length === 2) abort.abort();
      return stamp;
    });
    expect(await gatherAuthorizedPromptContext({ ...options, signal: abort.signal })).toBeUndefined();
    expect(options.gather).toHaveBeenCalledTimes(stage === "recheck" ? 1 : 0);
  });

  it("does not use a cached stamp when the authoritative read fails", async () => {
    const options = fixture();
    options.readStamp.mockRejectedValue(new Error("Synthetic disconnected transport"));
    await expect(gatherAuthorizedPromptContext(options)).rejects.toThrow(/disconnected/);
    expect(options.gather).not.toHaveBeenCalled();
  });
});
