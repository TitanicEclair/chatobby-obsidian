import type { WsPromptContextPacket } from "../vendor/chatobby-client/connector-types.js";

type ContextStamp = NonNullable<WsPromptContextPacket["obsidianVaultAccess"]>;

interface AuthorizedContextOptions {
  readonly sessionId: string;
  readonly readStamp: () => Promise<ContextStamp | undefined>;
  readonly isCurrentTarget: () => boolean;
  readonly gather: () => WsPromptContextPacket;
  readonly signal?: AbortSignal;
}

/** Gather passive Obsidian context only between two matching host-owned eligibility reads. */
export async function gatherAuthorizedPromptContext(
  options: AuthorizedContextOptions,
): Promise<WsPromptContextPacket | undefined> {
  const assertTarget = () => {
    if (!options.isCurrentTarget()) throw new Error("The active chat changed before the prompt was sent. Try again in the intended chat.");
  };
  if (options.signal?.aborted) return undefined;
  assertTarget();
  const current = await options.readStamp();
  if (options.signal?.aborted) return undefined;
  assertTarget();
  if (!current) return undefined;
  if (current.sessionId !== options.sessionId) throw new Error("Obsidian context does not belong to the active chat. Refresh this chat and try again.");
  const collectedUnder = { ...current };
  const packet = options.gather();
  const latest = await options.readStamp();
  if (options.signal?.aborted) return undefined;
  assertTarget();
  if (!latest || !sameStamp(collectedUnder, latest)) return undefined;
  return { ...packet, obsidianVaultAccess: collectedUnder };
}

function sameStamp(left: ContextStamp, right: ContextStamp): boolean {
  return left.sessionId === right.sessionId
    && left.vaultId === right.vaultId
    && left.bindingRevision === right.bindingRevision
    && left.policyRevision === right.policyRevision;
}
