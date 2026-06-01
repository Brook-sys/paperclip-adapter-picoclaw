import type { AdapterExecutionContext } from "./types.js";
import type { AdapterExecutionResult } from "./types.js";
export interface ExecConfig {
    gatewayUrl: string;
    token: string;
    timeoutMs: number;
    sessionStrategy: string;
    promptMode: string;
}
export declare function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult>;
