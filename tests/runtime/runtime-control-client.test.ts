import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeControlClient } from "../../src/runtime/infrastructure/runtime-control-client";
import type {
  RuntimeReadyDescriptor,
  RuntimeStatusResponse,
} from "../../src/vendor/chatobby-client/ws-client.js";

describe("RuntimeControlClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses an authenticated Node loopback connection instead of renderer fetch", async () => {
    const requests: Array<{
		authorization: string | undefined;
		attachmentId: string | undefined;
		method: string | undefined;
		url: string | undefined;
	}> = [];
    const identity = {
      instanceId: "runtime-1",
      vaultId: "vault-1",
      pid: 42,
      startedAt: 1_700_000_000_000,
      runtimeVersion: "0.1.0",
      protocolVersion: 1,
      runtimePackageFingerprint: null,
    };
    const status: RuntimeStatusResponse = { ready: true, identity };
    const server = createServer((request, response) => {
      requests.push({
        authorization: request.headers.authorization,
		attachmentId: request.headers["x-chatobby-attachment-id"] as string | undefined,
        method: request.method,
        url: request.url,
      });
      response.writeHead(200, { "content-type": "application/json", connection: "close" });
      response.end(JSON.stringify(request.url === "/api/runtime/status" ? status : { ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const descriptor: RuntimeReadyDescriptor = {
      ...identity,
      schemaVersion: 2,
      host: "127.0.0.1",
      port: address.port,
      controlTokenFingerprint: "a".repeat(64),
      sessionTokenFingerprint: "b".repeat(64),
    };
    const rendererFetch = vi.fn(() => Promise.reject(new Error("renderer fetch blocked")));
    vi.stubGlobal("fetch", rendererFetch);

    try {
      const client = new RuntimeControlClient();
      await expect(client.status(descriptor, "control-secret")).resolves.toEqual(status);
      await expect(client.detach(descriptor, "control-secret", "plugin-instance")).resolves.toBeUndefined();
      await expect(client.shutdown(descriptor, "control-secret")).resolves.toBeUndefined();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }

    expect(rendererFetch).not.toHaveBeenCalled();
    expect(requests).toEqual([
      { authorization: "Bearer control-secret", attachmentId: undefined, method: "GET", url: "/api/runtime/status" },
      { authorization: "Bearer control-secret", attachmentId: "plugin-instance", method: "POST", url: "/api/runtime/detach" },
      { authorization: "Bearer control-secret", attachmentId: undefined, method: "POST", url: "/api/runtime/shutdown" },
    ]);
  });
});
