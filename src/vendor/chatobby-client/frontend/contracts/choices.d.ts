export interface FrontendChoiceOption {
    readonly value: string;
    readonly label: string;
    readonly description?: string;
    readonly disabledReason?: string;
}
export declare function validateChoices(value: unknown, label: string): void;
export declare function parseChoiceOption(value: unknown, label: string, allowEmptyValue?: boolean): FrontendChoiceOption;
