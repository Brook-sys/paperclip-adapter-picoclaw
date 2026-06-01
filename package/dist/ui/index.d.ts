import { parseStdoutLine } from "./parse-stdout.js";
export declare const configSchema: {
    type: string;
    properties: {
        gatewayUrl: {
            type: string;
            title: string;
            description: string;
            default: string;
        };
        token: {
            type: string;
            title: string;
            description: string;
            format: string;
        };
        sessionStrategy: {
            type: string;
            title: string;
            enum: string[];
            default: string;
        };
        timeoutMs: {
            type: string;
            title: string;
            default: number;
        };
        promptMode: {
            type: string;
            title: string;
            enum: string[];
            default: string;
        };
    };
    required: string[];
};
export { parseStdoutLine };
