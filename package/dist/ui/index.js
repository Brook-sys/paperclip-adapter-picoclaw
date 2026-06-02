import { parseStdoutLine } from "./parse-stdout.js";
// Metadata for the UI config form
export const configSchema = {
    type: "object",
    properties: {
        gatewayUrl: {
            type: "string",
            title: "PicoClaw Gateway URL",
            description: "WebSocket endpoint (e.g., ws://127.0.0.1:18790/pico)",
            default: "ws://127.0.0.1:18790/pico"
        },
        token: {
            type: "string",
            title: "Authentication Token",
            description: "Secure token from your PicoClaw config",
            format: "password"
        },
        sessionStrategy: {
            type: "string",
            title: "Session Strategy",
            enum: ["issue", "run", "fixed"],
            default: "issue"
        },
        timeoutMs: {
            type: "number",
            title: "Timeout (ms)",
            default: 300000
        },
        completionGraceMs: {
            type: "number",
            title: "Completion Grace Timer (ms)",
            description: "How long to wait after the agent stops typing before closing the connection",
            default: 5000
        },
        promptMode: {
            type: "string",
            title: "Prompt Mode",
            enum: ["compact", "full"],
            default: "compact"
        }
    },
    required: ["gatewayUrl", "token"]
};
// Also export the UI parser here if Paperclip expects it here
export { parseStdoutLine };
