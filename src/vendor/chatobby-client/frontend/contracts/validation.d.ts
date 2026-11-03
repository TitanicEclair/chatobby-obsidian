import type { ThinkingLevel } from "../../wire-types.js";
/** Shared primitive for strict browser-safe frontend parsing. */
export declare function requireRecord(value: unknown, label: string): Record<string, unknown>;
/** Shared primitive for strict browser-safe frontend parsing. */
export declare function requireString(value: unknown, label: string): string;
/** Shared primitive for strict browser-safe frontend parsing. */
export declare function requireSafeInteger(value: unknown, label: string): number;
/** Shared primitive for strict browser-safe frontend parsing. */
export declare function requireBoolean(value: unknown, label: string): boolean;
/** Shared primitive for strict browser-safe frontend parsing. */
export declare function requireEnumValue<const Value extends string>(value: unknown, label: string, values: readonly Value[]): Value;
/** Shared primitive for strict browser-safe frontend parsing. */
export declare function optionalString(value: unknown, label: string): string | undefined;
/** Shared primitive for strict browser-safe frontend parsing. */
export declare function validateArray(value: unknown, label: string, validate: (entry: unknown, label: string) => void): void;
/** Shared primitive for strict browser-safe frontend parsing. */
export declare function requireArray(value: unknown, label: string): unknown[];
export declare function requireNumberRecord(value: unknown, label: string): Readonly<Record<string, number>>;
export declare function requireThinkingLevel(value: unknown, label: string): ThinkingLevel;
export declare function requireJsonValue(value: unknown, label: string, seen?: Set<object>): void;
export declare function requireTextValue(value: unknown, label: string): string;
export declare function optionalTextValue(value: unknown, label: string): string | undefined;
export declare function requireFiniteNumber(value: unknown, label: string): number;
export declare function optionalFiniteNumber(value: unknown, label: string): number | undefined;
export declare function validateStringRecord(value: unknown, label: string): void;
export declare function optionalNullableString(value: unknown, label: string): string | null | undefined;
export declare function optionalSafeInteger(value: unknown, label: string): number | undefined;
export declare function requireStringArray(value: unknown, label: string): string[];
