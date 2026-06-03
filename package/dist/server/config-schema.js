export function getConfigSchema() {
    return {
        fields: [
            {
                key: "gatewayUrl",
                label: "PicoClaw Gateway URL",
                type: "text",
                default: "ws://127.0.0.1:18790/pico/ws",
                required: true,
                hint: "The WebSocket endpoint for the Pico Protocol (e.g. ws://localhost:18790/pico/ws)",
            },
            {
                key: "token",
                label: "Authentication Token",
                type: "text", // using text since 'password' isn't explicitly in the type definition above, though UI might support it
                required: true,
                hint: "The secure authentication token from channels.pico.token in PicoClaw config",
            },
            {
                key: "promptTemplate",
                label: "Prompt Template",
                type: "text",
                hint: "Optional template for the user prompt. Use {{prompt}} as the placeholder.",
            },
            {
                key: "gatewayConstraints",
                label: "Custom System Constraints",
                type: "text",
                hint: "Optional extra instructions to append to the system prompt before execution.",
            },
            {
                key: "paperclipApiUrlOverride",
                label: "Paperclip API URL Override",
                type: "text",
                hint: "Optional base URL for the Paperclip API as seen from PicoClaw, e.g. http://localhost:3100. Leave blank to use Paperclip runtime API URL.",
            },
            {
                key: "instructionsFilePath",
                label: "Instructions File Path",
                type: "text",
                hint: "Absolute path to a Markdown file with base instructions to prepend to the run.",
            },
            {
                key: "sessionStrategy",
                label: "Session Strategy",
                type: "select",
                default: "issue",
                options: [
                    { value: "issue", label: "Issue (Recommended)" },
                    { value: "run", label: "Run (New session every time)" },
                    { value: "agent", label: "Agent (Shared across runs)" },
                    { value: "fixed", label: "Fixed" },
                ],
                hint: "How to manage session memory inside PicoClaw.",
            },
            {
                key: "timeoutSec",
                label: "Run Timeout (sec)",
                type: "number",
                default: 300,
            },
            {
                key: "graceSec",
                label: "Completion Grace (sec)",
                type: "number",
                default: 5,
                hint: "How long to wait after the agent stops typing before closing the connection. Increase if messages are being cut off.",
            },
            {
                key: "promptMode",
                label: "Prompt Mode",
                type: "select",
                default: "compact",
                options: [
                    { value: "compact", label: "Compact (Task Only)" },
                    { value: "full", label: "Full (Includes full repo context)" },
                ],
                hint: "If PicoClaw runs on the same machine, Compact is better since it uses its own tools to read the workspace.",
            },
        ],
    };
}
