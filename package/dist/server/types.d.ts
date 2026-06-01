export interface AdapterAgent {
    id: string;
    companyId: string;
    name: string;
    adapterType: string;
    adapterConfig: Record<string, unknown>;
}
export interface AdapterRuntime {
    sessionId: string;
    sessionParams: Record<string, unknown> | null;
    sessionDisplayId: string | null;
    taskKey: string | null;
}
export interface AdapterExecutionContext {
    runId: string;
    agent: AdapterAgent;
    runtime: AdapterRuntime;
    config: Record<string, unknown>;
    context: Record<string, unknown>;
    renderedPrompt?: string;
    onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
    onMeta?: (meta: Record<string, unknown>) => Promise<void>;
    authToken?: string;
}
export interface AdapterExecutionResult {
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    errorMessage?: string | null;
    errorCode?: string | null;
    errorFamily?: string | null;
    retryNotBefore?: string | null;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens?: number;
    } | null;
    sessionParams?: Record<string, unknown> | null;
    sessionDisplayId?: string | null;
    provider?: string | null;
    model?: string | null;
    billingType?: string | null;
    costUsd?: number | null;
    summary?: string | null;
    clearSession?: boolean;
}
export interface AdapterEnvironmentCheck {
    label: string;
    status: "info" | "warn" | "error";
    message: string;
}
export interface AdapterEnvironmentTestResult {
    status: "pass" | "warn" | "fail";
    checks: AdapterEnvironmentCheck[];
}
export interface ServerAdapterModule {
    type: string;
    execute: (ctx: AdapterExecutionContext) => Promise<AdapterExecutionResult>;
    testEnvironment: (ctx: {
        config: Record<string, unknown>;
    }) => Promise<AdapterEnvironmentTestResult>;
    sessionCodec?: {
        serialize: (params: Record<string, unknown> | null) => Record<string, unknown> | null;
        deserialize: (raw: unknown) => Record<string, unknown> | null;
        getDisplayId: (params: Record<string, unknown> | null) => string | null;
    };
    models?: Array<{
        id: string;
        label: string;
    }>;
    agentConfigurationDoc?: string;
    getConfigSchema?: () => Promise<any> | any;
    supportsInstructionsBundle?: boolean;
}
