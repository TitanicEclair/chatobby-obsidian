import type { App } from "obsidian";
import type { OperationDescriptor } from "../../operations/public";
import type { ChatobbyTransport } from "../../../transport/ws-client";
import type { WsStoredSessionSelector } from "../../../vendor/chatobby-client/connector-types";
import { getVaultBasePath } from "../../../ui/session/session-directory";

interface StoredSessionControllerOptions {
  app: App;
  ensureConnectedTransport: (action: string) => Promise<ChatobbyTransport | null>;
  runOperation: <T>(descriptor: OperationDescriptor, operation: () => Promise<T>) => Promise<T>;
}

/** Stable-ID-first stored-session mutations that never replace the active backend session. */
export class StoredSessionController {
  constructor(private readonly options: StoredSessionControllerOptions) {}

  async delete(selector: WsStoredSessionSelector): Promise<void> {
    await this.run("Deleting stored session", async (transport, cwdRoot) => {
      await transport.deleteSession(selector, cwdRoot);
    });
  }

  async rename(selector: WsStoredSessionSelector, name: string): Promise<void> {
    await this.run("Renaming stored session", async (transport, cwdRoot) => {
      await transport.renameStoredSession(selector, cwdRoot, name);
    });
  }

  forkMessages(selector: WsStoredSessionSelector): Promise<Array<{ entryId: string; text: string }>> {
    return this.run("Loading fork points", (transport, cwdRoot) => (
      transport.getStoredSessionForkMessages(selector, cwdRoot)
    ));
  }

  clone(selector: WsStoredSessionSelector): Promise<{ sessionId: string; sessionPath: string }> {
    return this.run("Cloning stored session", (transport, cwdRoot) => (
      transport.cloneStoredSession(selector, cwdRoot)
    ));
  }

  fork(selector: WsStoredSessionSelector, entryId: string): Promise<{ sessionId: string; sessionPath: string }> {
    return this.run("Forking stored session", (transport, cwdRoot) => (
      transport.forkStoredSession(selector, cwdRoot, entryId)
    ));
  }

  export(selector: WsStoredSessionSelector, format: "html" | "jsonl", outputPath: string): Promise<string> {
    return this.run(`Exporting stored session as ${format.toUpperCase()}`, (transport, cwdRoot) => (
      transport.exportStoredSession(selector, cwdRoot, format, outputPath)
    ));
  }

  private async run<T>(
    label: string,
    operation: (transport: ChatobbyTransport, cwdRoot: string) => Promise<T>,
  ): Promise<T> {
    return this.options.runOperation(
      { key: "session-maintenance", id: `session-maintenance:${label.toLocaleLowerCase().replaceAll(" ", "-")}`, label },
      async () => {
        const transport = await this.options.ensureConnectedTransport(label.toLocaleLowerCase());
        if (!transport) throw new Error("Chatobby backend is not connected");
        const cwdRoot = getVaultBasePath(this.options.app);
        if (!cwdRoot) throw new Error("Chatobby could not resolve the vault base path");
        return operation(transport, cwdRoot);
      },
    );
  }
}
