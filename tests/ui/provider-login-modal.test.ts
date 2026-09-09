import { afterEach, describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { ProviderLoginModal } from "../../src/ui/modals/provider-login-modal";
import type { ChatobbyTransport } from "../../src/transport/ws-client";
import type { WsProviderInfo } from "../../src/types";
import type { ProviderLoginState } from "../../src/vendor/chatobby-client/ws-client";

const provider: WsProviderInfo = { id: "xai", name: "xAI", configured: false, modelCount: 2, availableModelCount: 0,
  authentication: { apiKey: true, subscription: { label: "SuperGrok / X Premium", methods: ["device_code"] } } };
const pending: ProviderLoginState = { loginId: "test", provider: "xai", status: "pending", message: "Enter code",
  url: "https://auth.x.ai/activate", userCode: "TEST-CODE" };
afterEach(() => { vi.useRealTimers(); document.body.empty(); });
describe("provider sign-in modal", () => {
  it("shows device instructions, does not open a browser automatically, and cancels on close", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const transport = { startProviderLogin: vi.fn(async () => pending), cancelProviderLogin: vi.fn(async () => ({ ...pending, status: "cancelled" as const })) };
    const modal = new ProviderLoginModal({} as App, provider, async () => transport as unknown as ChatobbyTransport, vi.fn());
    modal.open();
    Array.from(modal.contentEl.querySelectorAll("button")).find((button) => button.textContent === "Sign in with a code")!.click();
    await vi.waitFor(() => expect(modal.contentEl.textContent).toContain("TEST-CODE"));
    expect(modal.contentEl.textContent).toContain("auth.x.ai");
    expect(open).not.toHaveBeenCalled();
    Array.from(modal.contentEl.querySelectorAll("button")).find((button) => button.textContent === "Open in browser")!.click();
    expect(open).toHaveBeenCalledExactlyOnceWith("https://auth.x.ai/activate", "_external", "noopener,noreferrer");
    modal.close();
    expect(transport.cancelProviderLogin).toHaveBeenCalledWith("test");
    expect(modal.contentEl.textContent).not.toContain("TEST-CODE");
    open.mockRestore();
  });
  it("refreshes provider choices after a persisted connection and stops polling", async () => {
    vi.useFakeTimers();
    const transport = { startProviderLogin: vi.fn(async () => pending), getProviderLogin: vi.fn(async () => ({ loginId: "test", provider: "xai", status: "connected" as const, message: "Connected" })), cancelProviderLogin: vi.fn() };
    const connected = vi.fn(async () => {});
    const modal = new ProviderLoginModal({} as App, provider, async () => transport as unknown as ChatobbyTransport, connected);
    modal.open();
    modal.contentEl.querySelector("button")!.click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(connected).toHaveBeenCalledOnce();
    expect(transport.getProviderLogin).toHaveBeenCalledOnce();
    expect(modal.contentEl.textContent).not.toContain("TEST-CODE");
    modal.close();
    expect(transport.cancelProviderLogin).not.toHaveBeenCalled();
  });
});
