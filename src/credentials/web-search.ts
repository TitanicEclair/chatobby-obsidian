export const CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE = "chatobby-web-search-brave";

interface SecretStoragePort {
  getSecret(id: string): string | null;
  setSecret(id: string, secret: string): void;
}

type CredentialSynchronizer = (reference: string, secret: string | null) => Promise<void>;

/** Keep the enhanced-search key in Obsidian SecretStorage and synchronize only its reference. */
export class WebSearchCredentialService {
  constructor(
    private readonly secretStorage: SecretStoragePort,
    private readonly synchronize: CredentialSynchronizer,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.secretStorage.getSecret(CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE));
  }

  async set(key: string): Promise<void> {
    const normalized = key.trim();
    if (!normalized) throw new Error("A Brave Search API key is required.");
    this.secretStorage.setSecret(CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE, normalized);
    await this.synchronize(CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE, normalized);
  }

  async remove(): Promise<void> {
    this.secretStorage.setSecret(CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE, "");
    await this.synchronize(CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE, null);
  }
}
