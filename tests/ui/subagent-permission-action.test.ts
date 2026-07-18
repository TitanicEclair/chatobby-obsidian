import { describe, expect, it } from "vitest";
import { resolveSubagentPermissionAction } from "../../src/ui/controller/subagent-permission-action";

describe("subagent permission feed actions", () => {
	it("decodes an exact selected value without losing punctuation", async () => {
		await expect(
			resolveSubagentPermissionAction(
				{} as never,
				"subagent-permission:approve:run-1:node-1:permission-1:Project%3A%20all%20notes",
			),
		).resolves.toEqual({
			runId: "run-1",
			nodeId: "node-1",
			permissionRequestId: "permission-1",
			approved: true,
			value: "Project: all notes",
		});
	});

	it("rejects malformed or value-bearing deny actions", async () => {
		await expect(
			resolveSubagentPermissionAction({}, "subagent-permission:deny:run-1:node-1:permission-1:unexpected"),
		).resolves.toBeNull();
	});

	it("collects a free-form value before approving an input permission", async () => {
		const decision = resolveSubagentPermissionAction(
			{} as never,
			"subagent-permission:input:run-1:node-1:permission-1",
		);
		const input = document.querySelector<HTMLInputElement>(".chatobby-prompt-input");
		const submit = document.querySelector<HTMLButtonElement>(".chatobby-modal-actions .mod-cta");
		if (!input || !submit) throw new Error("Expected the permission input modal.");
		input.value = "release/0.1.6";
		submit.click();

		await expect(decision).resolves.toEqual({
			runId: "run-1",
			nodeId: "node-1",
			permissionRequestId: "permission-1",
			approved: true,
			value: "release/0.1.6",
		});
	});
});
