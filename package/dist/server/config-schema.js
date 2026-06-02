export function getConfigSchema() {
    return {
        fields: [
            {
                key: "gatewayUrl",
                label: "PicoClaw Gateway URL",
                type: "text",
                default: "ws://127.0.0.1:18790/pico",
                required: true,
                hint: "The WebSocket endpoint for the Pico Protocol (e.g. ws://localhost:18790/pico)",
            },
            {
                key: "token",
                label: "Authentication Token",
                type: "text", // using text since 'password' isn't explicitly in the type definition above, though UI might support it
                required: true,
                hint: "The secure authentication token from channels.pico.token in PicoClaw config",
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
                key: "timeoutMs",
                label: "Timeout (ms)",
                type: "number",
                default: 300000,
            },
            {
                key: "completionGraceMs",
                label: "Completion Grace Timer (ms)",
                type: "number",
                default: 5000,
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
