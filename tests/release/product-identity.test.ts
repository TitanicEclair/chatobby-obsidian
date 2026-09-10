import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../manifest.json";
import { checkConnectorProductIdentity } from "../../scripts/check-product-identity.mjs";
import {
  CHATOBBY_PRODUCT_VERSION,
  CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
} from "../../src/vendor/chatobby-client/control/product.generated";

const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("connector release identity", () => {
  it("keeps manifest, package, versions, and generated connector identity at exact N", async () => {
    const identity = await checkConnectorProductIdentity(repositoryRoot);
    expect(identity.version).toBe(manifest.version);
    expect(CHATOBBY_PRODUCT_VERSION).toBe(identity.version);
    expect(CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION).toBe(3);
  });
});
