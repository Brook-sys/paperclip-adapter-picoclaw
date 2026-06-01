export interface TestConfig {
    gatewayUrl: string;
    token: string;
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
export declare function testEnvironment(ctx: {
    config: Record<string, unknown>;
}): Promise<AdapterEnvironmentTestResult>;
