// Generated from packages/chatobby/src/frontend/contracts/choices.ts. Do not edit.
import { optionalString, requireRecord, requireString, requireTextValue, validateArray } from "./validation.ts";

export interface FrontendChoiceOption {
	readonly value: string;
	readonly label: string;
	readonly description?: string;
	readonly disabledReason?: string;
}

function validateChoice(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	requireString(input.value, `${label}.value`);
	requireString(input.label, `${label}.label`);
	optionalString(input.description, `${label}.description`);
	optionalString(input.disabledReason, `${label}.disabledReason`);
}

export function validateChoices(value: unknown, label: string): void {
	validateArray(value, label, validateChoice);
}

export function parseChoiceOption(value: unknown, label: string, allowEmptyValue = false): FrontendChoiceOption {
	const input = requireRecord(value, label);
	return {
		value: allowEmptyValue
			? requireTextValue(input.value, `${label}.value`)
			: requireString(input.value, `${label}.value`),
		label: requireString(input.label, `${label}.label`),
		description: optionalString(input.description, `${label}.description`),
		disabledReason: optionalString(input.disabledReason, `${label}.disabledReason`),
	};
}
