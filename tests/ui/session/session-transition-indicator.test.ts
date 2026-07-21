import { describe, expect, it } from "vitest";
import { SessionTransitionIndicator } from "../../../src/ui/session/session-transition-indicator";

describe("SessionTransitionIndicator", () => {
  it("covers the view until the owning session transition completes", () => {
    const host = document.createElement("div");
    host.className = "is-hidden";
    const indicator = new SessionTransitionIndicator(host);

    indicator.setOperation({
      key: "session-transition",
      id: "session:resume",
      label: "Resuming session",
      startedAt: 1,
    });

    expect(host.classList.contains("is-hidden")).toBe(false);
    expect(host.getAttribute("aria-busy")).toBe("true");
    expect(host.textContent).toBe("Resuming session");
    expect(host.querySelector(".chatobby-session-transition__dots")).not.toBeNull();

    indicator.setOperation(null);
    expect(host.classList.contains("is-hidden")).toBe(true);
    expect(host.getAttribute("aria-busy")).toBe("false");
    expect(host.textContent).toBe("");
  });
});
