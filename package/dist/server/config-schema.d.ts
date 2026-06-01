export interface AdapterConfigField {
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "select" | "textarea" | "toggle";
    default?: string | number | boolean;
    required?: boolean;
    hint?: string;
    options?: Array<{
        value: string;
        label: string;
    }>;
    meta?: {
        visibleWhen?: {
            key: string;
            values: string[];
        };
    };
}
export interface AdapterConfigSchema {
    fields: AdapterConfigField[];
}
export declare function getConfigSchema(): AdapterConfigSchema;
