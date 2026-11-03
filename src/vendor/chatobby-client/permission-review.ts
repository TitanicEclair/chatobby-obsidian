// Generated from packages/chatobby-runtime-contracts/src/permission-review.ts. Do not edit.
/** Human review of one exact operation; the identifier is opaque and grants no authority by itself. */
export interface PermissionRequestReview {
	readonly requestId: string;
	readonly toolName: string;
	readonly reason: string;
	readonly operationSummary: string;
}

/** Validate review metadata at process/UI boundaries without accepting extra authority-bearing fields. */
export function parsePermissionRequestReview(value: unknown): PermissionRequestReview {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Permission review must be an object.");
	const record = value as Record<string, unknown>;
	const limits = { requestId: 256, toolName: 256, reason: 2_000, operationSummary: 64_000 } as const;
	if (Object.keys(record).some((key) => !Object.hasOwn(limits, key)))
		throw new Error("Unknown permission review field.");
	for (const key of Object.keys(limits) as Array<keyof typeof limits>) {
		const field = record[key];
		if (typeof field !== "string" || !field.trim() || field.length > limits[key])
			throw new Error(`Invalid permission review ${key}.`);
	}
	return Object.freeze({
		requestId: record.requestId as string,
		toolName: record.toolName as string,
		reason: record.reason as string,
		operationSummary: record.operationSummary as string,
	});
}
