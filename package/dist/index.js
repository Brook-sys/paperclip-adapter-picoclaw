export const type = "picoclaw";
export const label = "PicoClaw Gateway";
export const models = [
    { id: "default", label: "PicoClaw Default (Configured in Gateway)" },
];
export const agentConfigurationDoc = `# picoclaw agent configuration

Use when:
- You are connecting to a remote PicoClaw gateway.
- You want the agent to use tools and memory natively managed by PicoClaw.
- The environment requires lightweight WebSocket streaming (Pico Protocol).

Don't use when:
- You want Paperclip to control local execution step-by-step (use a local CLI adapter like \`claude_local\`).

Core fields:
- \`gatewayUrl\`: The WebSocket endpoint of the PicoClaw gateway (e.g., \`ws://127.0.0.1:18790/pico\`).
- \`token\`: The secure authentication token for the channel.
- \`sessionStrategy\`: Context scoping (\`issue\` recommended).
- \`timeoutMs\`: Max wait time per run.
`;
export { createServerAdapter } from "./server/index.js";
export { configSchema, parseStdoutLine } from "./ui/index.js";
