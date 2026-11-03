// Generated from packages/chatobby/src/frontend/contracts/validation.ts. Do not edit.
import type { ThinkingLevel } from "../../wire-types.ts";

/** Shared primitive for strict browser-safe frontend parsing. */
export function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

/** Shared primitive for strict browser-safe frontend parsing. */
export function requireString(value: unknown, label: string): string {
	if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
	return value;
}

/** Shared primitive for strict browser-safe frontend parsing. */
export function requireSafeInteger(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		throw new Error(`${label} must be a non-negative safe integer`);
	return value as number;
}

/** Shared primitive for strict browser-safe frontend parsing. */
export function requireBoolean(value: unknown, label: string): boolean {
	if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
	return value;
}

/** Shared primitive for strict browser-safe frontend parsing. */
export function requireEnumValue<const Value extends string>(
	value: unknown,
	label: string,
	values: readonly Value[],
): Value {
	if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
		throw new Error(`${label} is invalid`);
	}
	return value as Value;
}

/** Shared primitive for strict browser-safe frontend parsing. */
export function optionalString(value: unknown, label: string): string | undefined {
	if (value === undefined) return undefined;
	return requireString(value, label);
}

/** Shared primitive for strict browser-safe frontend parsing. */
export function validateArray(value: unknown, label: string, validate: (entry: unknown, label: string) => void): void {
	requireArray(value, label).forEach((entry, index) => {
		validate(entry, `${label}[${index}]`);
	});
}

/** Shared primitive for strict browser-safe frontend parsing. */
export function requireArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
	return value;
}

export function requireNumberRecord(value: unknown, label: string): Readonly<Record<string, number>> {
	const input = requireRecord(value, label);
	return Object.fromEntries(
		Object.entries(input).map(([key, entry]) => [key, requireSafeInteger(entry, `${label}.${key}`)]),
	);
}

export function requireThinkingLevel(value: unknown, label: string): ThinkingLevel {
	if (
		value === "off" ||
		value === "minimal" ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	)
		return value;
	throw new Error(`${label} is invalid`);
}

export function requireJsonValue(value: unknown, label: string, seen = new Set<object>()): void {
	if (value === null || typeof value === "string" || typeof value === "boolean") return;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number`);
		return;
	}
	if (typeof value !== "object") throw new Error(`${label} contains a non-JSON value`);
	if (seen.has(value)) throw new Error(`${label} contains a cycle`);
	seen.add(value);
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			requireJsonValue(entry, `${label}[${index}]`, seen);
		});
	} else {
		for (const [key, entry] of Object.entries(value)) {
			if (key === "__proto__" || key === "prototype" || key === "constructor") {
				throw new Error(`${label} contains a forbidden key`);
			}
			requireJsonValue(entry, `${label}.${key}`, seen);
		}
	}
	seen.delete(value);
}

export function requireTextValue(value: unknown, label: string): string {
	if (typeof value !== "string") throw new Error(`${label} must be a string`);
	return value;
}

export function optionalTextValue(value: unknown, label: string): string | undefined {
	return value === undefined ? undefined : requireTextValue(value, label);
}

export function requireFiniteNumber(value: unknown, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw new Error(`${label} must be a non-negative finite number`);
	}
	return value;
}

export function optionalFiniteNumber(value: unknown, label: string): number | undefined {
	return value === undefined ? undefined : requireFiniteNumber(value, label);
}

export function validateStringRecord(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	for (const [key, entry] of Object.entries(input)) requireString(entry, `${label}.${key}`);
}

export function optionalNullableString(value: unknown, label: string): string | null | undefined {
	if (value === undefined || value === null) return value;
	return requireString(value, label);
}

export function optionalSafeInteger(value: unknown, label: string): number | undefined {
	return value === undefined ? undefined : requireSafeInteger(value, label);
}

export function requireStringArray(value: unknown, label: string): string[] {
	return requireArray(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));
}
