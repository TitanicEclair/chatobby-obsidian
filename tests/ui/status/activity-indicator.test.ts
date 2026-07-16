import { describe, expect, it } from "vitest";
import { ActivityIndicator } from "../../../src/ui/toolbar/status/activity-indicator";
import { mount } from "../helpers/mount";

describe("ActivityIndicator", () => {
  it("renders label and spinner hooks", () => {
    const indicator = new ActivityIndicator();
    const el = mount(indicator);
    indicator.setActivity("running");
    expect(el.querySelector(".chatobby-activity-indicator__spinner")).toBeTruthy();
    expect(el.querySelector(".chatobby-activity-indicator__label")?.textContent).toBe("running");
    expect(el.classList.contains("is-active")).toBe(true);
  });
});
