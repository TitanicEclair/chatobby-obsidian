import type { OperationHandler } from "../types";
import { BridgeError } from "../types";
import { getObsidianUiSnapshotService } from "../../obsidian-context";

const UI_ACTIONS = new Set(["click", "focus", "set_expanded", "set_value"] as const);

function requiredString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new BridgeError("INVALID_INPUT", `ui.interact requires a non-empty '${field}' string`);
	}
	return value;
}

export const handleUiSnapshot: OperationHandler = async (args, signal, app) => {
  return getObsidianUiSnapshotService(app).snapshot({
    ...(typeof args.leafId === "string" ? { leafId: args.leafId } : {}),
    ...(typeof args.cursor === "string" ? { cursor: args.cursor } : {}),
    ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
  }, signal);
};

export const handleUiInteract: OperationHandler = async (args, signal, app) => {
	const action = args.action;
	if (typeof action !== "string" || !UI_ACTIONS.has(action as "click" | "focus" | "set_expanded" | "set_value")) {
		throw new BridgeError("INVALID_INPUT", "ui.interact action must be click, focus, set_expanded, or set_value");
	}
	return getObsidianUiSnapshotService(app).interact({
		ref: requiredString(args.ref, "ref"),
		documentRevision: requiredString(args.documentRevision, "documentRevision"),
		action: action as "click" | "focus" | "set_expanded" | "set_value",
    ...(typeof args.value === "string" ? { value: args.value } : {}),
    ...(typeof args.expanded === "boolean" ? { expanded: args.expanded } : {}),
  }, signal);
};
