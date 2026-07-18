import type { App } from "obsidian";
import { promptText } from "../modals/modals";

export interface SubagentPermissionDecisionPayload {
	readonly runId: string;
	readonly nodeId: string;
	readonly permissionRequestId: string;
	readonly approved: boolean;
	readonly value?: string;
}

/** Parse one feed action and collect a value only when the child requested free-form input. */
export async function resolveSubagentPermissionAction(
	app: App,
	actionId: string,
): Promise<SubagentPermissionDecisionPayload | null> {
	const [prefix, decision, runId, nodeId, permissionRequestId, value, ...rest] = actionId
		.split(":")
		.map((part) => decodeURIComponent(part));
	if (
		prefix !== "subagent-permission" ||
		(decision !== "approve" && decision !== "deny" && decision !== "input") ||
		!runId ||
		!nodeId ||
		!permissionRequestId ||
		rest.length > 0 ||
		(decision === "deny" && value !== undefined)
	) return null;
	const requestedValue = decision === "input"
		? await promptText(app, {
				title: "Subagent permission",
				placeholder: "Enter the value to provide…",
				submitLabel: "Continue",
			})
		: value;
	if (decision === "input" && requestedValue === null) return null;
	return {
		runId,
		nodeId,
		permissionRequestId,
		approved: decision !== "deny",
		value: requestedValue ?? undefined,
	};
}
