import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type ChatobbyPlugin from "../../src/main";
import * as obsidianContext from "../../src/obsidian-context";
import { createFrontendNegotiationRequest } from "../../src/ui/controller/frontend-bootstrap-request";
import { CHATOBBY_FRONTEND_OPTIONAL_CAPABILITIES, CHATOBBY_FRONTEND_REQUIRED_CAPABILITIES } from "../../src/vendor/chatobby-client/frontend-contracts";

const productBuild = vi.hoisted(() => ({ nativeSandbox: false }));
vi.mock("../../src/vendor/chatobby-client/control/product.generated", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  get CHATOBBY_NATIVE_SANDBOX_ENABLED() { return productBuild.nativeSandbox; },
}));

afterEach(() => { productBuild.nativeSandbox = false; vi.restoreAllMocks(); });

describe("frontend capability negotiation", () => {
  it.each([
    ["permissions", false], ["full-access", false], ["native-sandbox", true],
  ] as const)("offers only active product capabilities for %s", (_mode, nativeSandbox) => {
    productBuild.nativeSandbox = nativeSandbox;
    const app = { vault: { getName: () => "Synthetic Vault" }, internalPlugins: { plugins: {} },
      plugins: { manifests: {}, enabledPlugins: new Set() } } as unknown as App;
    const plugin = { manifest: { version: "0.5.3", minAppVersion: "1.12.7" } } as unknown as ChatobbyPlugin;
    const capabilities = createFrontendNegotiationRequest(app, plugin, "development-pair-view").capabilities.protocolCapabilities;

    // Even an older product flag cannot restore the retired setup capability.
    expect(capabilities).not.toContain("native-sandbox-setup");
    expect(capabilities.filter((value) => value !== "native-sandbox-setup")).toEqual([
      ...CHATOBBY_FRONTEND_REQUIRED_CAPABILITIES,
      ...CHATOBBY_FRONTEND_OPTIONAL_CAPABILITIES.filter((value) => value !== "native-sandbox-setup"),
    ]);
  });

  it("advertises capabilities without gathering passive note/editor/UI context", () => {
    const semantic = vi.spyOn(obsidianContext, "getObsidianSemanticContextService").mockImplementation(() => {
      throw new Error("Passive semantic context must not be collected before authorization.");
    });
    const ui = vi.spyOn(obsidianContext, "getObsidianUiSnapshotService").mockImplementation(() => {
      throw new Error("Passive UI context must not be collected before authorization.");
    });
    const app = {
      vault: { getName: () => "Synthetic Vault" },
      version: "1.13.7",
      internalPlugins: { plugins: { webviewer: { enabled: true, manifest: { name: "Web Viewer" } } } },
      plugins: { manifests: { "unrelated-plugin": { name: "Unrelated" } }, enabledPlugins: new Set() },
    } as unknown as App;
    const plugin = { manifest: { version: "0.4.3", minAppVersion: "1.12.7" } } as unknown as ChatobbyPlugin;

    const request = createFrontendNegotiationRequest(app, plugin, "synthetic-view");

    expect(request.capabilities.featureFamilies.length).toBeGreaterThan(0);
    expect(request.capabilities.integrations).toEqual([
      { id: "webviewer", name: "Web Viewer", installed: true, enabled: true },
    ]);
    expect(request).not.toHaveProperty("context");
    expect(request.capabilities.protocolCapabilities).toContain("obsidian-vault-access");
    expect(semantic).not.toHaveBeenCalled();
    expect(ui).not.toHaveBeenCalled();
  });
});
