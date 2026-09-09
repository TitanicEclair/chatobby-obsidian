import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type ChatobbyPlugin from "../../src/main";
import * as obsidianContext from "../../src/obsidian-context";
import { createFrontendNegotiationRequest } from "../../src/ui/controller/frontend-bootstrap-request";

afterEach(() => vi.restoreAllMocks());

describe("frontend capability negotiation", () => {
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
