import type { App } from "obsidian";
import type { OperationDescriptor } from "../../operations/public";
import type { ChatobbyTransport } from "../../../transport/ws-client";
import { getVaultBasePath } from "../../../ui/session/session-directory";

interface StoredSessionControllerOptions {
  app: App;
  ensureConnectedTransport: (action: string) => Promise<ChatobbyTransport | null>;
  runOperation: <T>(descriptor: OperationDescriptor, operation: () => Promise<T>) => Promise<T>;
}

/** Path-addressed stored-session mutations that never replace the active backend session. */
export class StoredSessionController {
  constructor(private readonly options: StoredSessionControllerOptions) {}

  async delete(sessionPath: string): Promise<void> {
    await this.run("Deleting stored session", async (transport, cwdRoot) => {
      await transport.deleteSession(sessionPath, cwdRoot);
    });
  }

  async rename(sessionPath: string, name: string): Promise<void> {
    await this.run("Renaming stored session", async (transport, cwdRoot) => {
      await transport.renameStoredSession(sessionPath, cwdRoot, name);
    });
  }

  forkMessages(sessionPath: string): Promise<Array<{ entryId: string; text: string }>> {
    return this.run("Loading fork points", (transport, cwdRoot) => (
      transport.getStoredSessionForkMessages(sessionPath, cwdRoot)
    ));
  }

  clone(sessionPath: string): Promise<{ sessionId: string; sessionPath: string }> {
    return this.run("Cloning stored session", (transport, cwdRoot) => (
      transport.cloneStoredSession(sessionPath, cwdRoot)
    ));
  }

  fork(sessionPath: string, entryId: string): Promise<{ sessionId: string; sessionPath: string }> {
    return this.run("Forking stored session", (transport, cwdRoot) => (
      transport.forkStoredSession(sessionPath, cwdRoot, entryId)
    ));
  }

  export(sessionPath: string, format: "html" | "jsonl", outputPath: string): Promise<string> {
    return this.run(`Exporting stored session as ${format.toUpperCase()}`, (transport, cwdRoot) => (
      transport.exportStoredSession(sessionPath, cwdRoot, format, outputPath)
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
