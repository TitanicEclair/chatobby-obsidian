import { describe, expect, it, vi } from "vitest";
import { ChatobbyView } from "../../src/ui/view";
import type { WsPromptAttachment, VaultContext } from "../../src/types";
import type { WsPromptContextPacket } from "../../src/vendor/chatobby-client/connector-types.js";

type Stamp = NonNullable<WsPromptContextPacket["obsidianVaultAccess"]>;
const stamp: Stamp = { sessionId: "session-a", vaultId: "vault-a", bindingRevision: 3, policyRevision: 7 };
const explicit: WsPromptAttachment[] = [{ type: "file_ref", path: "C:/synthetic-never-opened.txt", name: "explicit.txt", mimeType: "text/plain" }];

function fixture() {
  const getObsidianVaultAccessContext = vi.fn<() => Promise<Stamp | undefined>>(async () => undefined);
  const prompt = vi.fn(async () => "started" as const);
  const transport = { isConnected: true, getObsidianVaultAccessContext, prompt };
  const snapshot = { runtimeInstanceId: "runtime-a", session: { id: "session-a" } };
  const gatherContext = vi.fn<() => VaultContext>(() => ({ frontend: "obsidian", vault: "SYNTHETIC_PASSIVE", notePath: "PASSIVE.md", selection: "PASSIVE_SELECTION" }));
  const renderPromptFailure = vi.fn();
  const supportsCapability = vi.fn(() => true);
  const completeOnboarding = vi.fn(async () => {});
  const dispatch = vi.fn();
  const view = Object.assign(Object.create(ChatobbyView.prototype) as ChatobbyView, {
    componentsReady: true,
    closeSlashMenu: vi.fn(),
    ensureConnectedTransport: async () => transport,
    getTransport: () => transport,
    sessions: { ensureActiveSessionTarget: async () => {}, workingDirectoryPath: () => "", sessionState: { messages: [] }, activeTab: () => ({ name: "Synthetic" }) },
    frontendStore: { snapshot },
    frontendProtocol: { supportsCapability },
    getFeedStore: () => ({ dispatch }),
    gatherContext,
    renderPromptFailure,
    plugin: { completeOnboarding },
  });
  return { view, transport, snapshot, prompt, gatherContext, renderPromptFailure, dispatch, supportsCapability, completeOnboarding };
}

describe("actual ChatobbyView passive-context submission boundary", () => {
  it("does not request or gather passive context without the current negotiated capability", async () => {
    const fixtureState = fixture();
    fixtureState.supportsCapability.mockReturnValue(false);
    fixtureState.transport.getObsidianVaultAccessContext.mockResolvedValue(stamp);
    await fixtureState.view["sendPrompt"]("EXPLICIT_TEXT", explicit);
    expect(fixtureState.transport.getObsidianVaultAccessContext).not.toHaveBeenCalled();
    expect(fixtureState.gatherContext).not.toHaveBeenCalled();
    expect(fixtureState.prompt).toHaveBeenCalledExactlyOnceWith("EXPLICIT_TEXT", explicit, undefined, undefined);
  });

  it("keeps explicit text/attachments while Off prevents all passive collection", async () => {
    const fixtureState = fixture();
    await fixtureState.view["sendPrompt"]("EXPLICIT_TEXT", explicit);
    expect(fixtureState.gatherContext).not.toHaveBeenCalled();
    expect(fixtureState.prompt).toHaveBeenCalledExactlyOnceWith("EXPLICIT_TEXT", explicit, undefined, undefined);
  });

  it("echoes a twice-confirmed host stamp with gathered context", async () => {
    const fixtureState = fixture();
    fixtureState.transport.getObsidianVaultAccessContext.mockResolvedValue({ ...stamp });
    await fixtureState.view["sendPrompt"]("EXPLICIT_TEXT", explicit);
    expect(fixtureState.gatherContext).toHaveBeenCalledOnce();
    expect(fixtureState.transport.getObsidianVaultAccessContext).toHaveBeenCalledTimes(2);
    expect(fixtureState.prompt).toHaveBeenCalledExactlyOnceWith("EXPLICIT_TEXT", explicit,
      expect.objectContaining({ obsidianVaultAccess: stamp, activeNote: expect.objectContaining({ path: "PASSIVE.md" }) }), undefined);
  });

  it("drops revoked passive context but does not discard explicitly supplied attachments", async () => {
    const fixtureState = fixture();
    fixtureState.transport.getObsidianVaultAccessContext.mockResolvedValueOnce(stamp).mockResolvedValueOnce(undefined);
    await fixtureState.view["sendPrompt"]("EXPLICIT_TEXT", explicit);
    expect(fixtureState.gatherContext).toHaveBeenCalledOnce();
    expect(fixtureState.prompt).toHaveBeenCalledExactlyOnceWith("EXPLICIT_TEXT", explicit, undefined, undefined);
  });

  it.each(["session", "runtime", "disconnect", "closed"] as const)("does not retarget a prompt after %s changes during the host check", async (change) => {
    const fixtureState = fixture();
    fixtureState.transport.getObsidianVaultAccessContext.mockImplementation(async () => {
      if (change === "session") fixtureState.snapshot.session.id = "session-b";
      if (change === "runtime") fixtureState.snapshot.runtimeInstanceId = "runtime-b";
      if (change === "disconnect") fixtureState.transport.isConnected = false;
      if (change === "closed") Object.assign(fixtureState.view, { componentsReady: false });
      return stamp;
    });
    await expect(fixtureState.view["sendPrompt"]("EXPLICIT_TEXT", explicit)).rejects.toThrow(/active chat changed/);
    expect(fixtureState.gatherContext).not.toHaveBeenCalled();
    expect(fixtureState.prompt).not.toHaveBeenCalled();
    expect(fixtureState.renderPromptFailure).toHaveBeenCalledOnce();
  });

  it("does not send after cancellation while awaiting eligibility", async () => {
    const fixtureState = fixture();
    const abort = new AbortController();
    fixtureState.transport.getObsidianVaultAccessContext.mockImplementation(async () => { abort.abort(); return stamp; });
    await fixtureState.view["sendPrompt"]("EXPLICIT_TEXT", explicit, abort.signal);
    expect(fixtureState.gatherContext).not.toHaveBeenCalled();
    expect(fixtureState.prompt).not.toHaveBeenCalled();
    expect(fixtureState.completeOnboarding).not.toHaveBeenCalled();
  });
});
