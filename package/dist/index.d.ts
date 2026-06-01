export declare const type = "picoclaw";
export declare const label = "PicoClaw Gateway";
export declare const models: {
    id: string;
    label: string;
}[];
export declare const agentConfigurationDoc = "# picoclaw agent configuration\n\nUse when:\n- You are connecting to a remote PicoClaw gateway.\n- You want the agent to use tools and memory natively managed by PicoClaw.\n- The environment requires lightweight WebSocket streaming (Pico Protocol).\n\nDon't use when:\n- You want Paperclip to control local execution step-by-step (use a local CLI adapter like `claude_local`).\n\nCore fields:\n- `gatewayUrl`: The WebSocket endpoint of the PicoClaw gateway (e.g., `ws://127.0.0.1:18790/pico`).\n- `token`: The secure authentication token for the channel.\n- `sessionStrategy`: Context scoping (`issue` recommended).\n- `timeoutMs`: Max wait time per run.\n";
export { createServerAdapter } from "./server/index.js";
export { configSchema } from "./ui/index.js";
