import { describe, expect, it, vi } from "vitest";
import {
  CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE,
  WebSearchCredentialService,
} from "../../src/credentials/web-search";

describe("WebSearchCredentialService", () => {
  it("stores only in secret storage and synchronizes the fixed reference", async () => {
    const values = new Map<string, string>();
    const synchronize = vi.fn(async () => undefined);
    const service = new WebSearchCredentialService({
      getSecret: (id) => values.get(id) ?? null,
      setSecret: (id, value) => { values.set(id, value); },
    }, synchronize);

    expect(service.isConfigured()).toBe(false);
    await service.set("  brave-secret  ");
    expect(service.isConfigured()).toBe(true);
    expect(values.get(CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE)).toBe("brave-secret");
    expect(synchronize).toHaveBeenLastCalledWith(
      CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE,
      "brave-secret",
    );

    await service.remove();
    expect(service.isConfigured()).toBe(false);
    expect(synchronize).toHaveBeenLastCalledWith(
      CHATOBBY_BRAVE_SEARCH_CREDENTIAL_REFERENCE,
      null,
    );
  });

  it("rejects an empty key without writing or synchronizing", async () => {
    const setSecret = vi.fn();
    const synchronize = vi.fn(async () => undefined);
    const service = new WebSearchCredentialService({
      getSecret: () => null,
      setSecret,
    }, synchronize);

    await expect(service.set("  ")).rejects.toThrow("required");
    expect(setSecret).not.toHaveBeenCalled();
    expect(synchronize).not.toHaveBeenCalled();
  });
});
