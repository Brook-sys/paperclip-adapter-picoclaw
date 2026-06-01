import WebSocket from "ws";
function resolveTestConfig(config) {
    return {
        gatewayUrl: String(config.gatewayUrl ?? "ws://127.0.0.1:18790/pico"),
        token: String(config.token ?? ""),
    };
}
export async function testEnvironment(ctx) {
    const config = resolveTestConfig(ctx.config);
    const checks = [];
    if (!config.gatewayUrl) {
        checks.push({
            label: "Gateway URL",
            status: "error",
            message: "gatewayUrl is not configured.",
        });
        return { status: "fail", checks };
    }
    if (!config.token) {
        checks.push({
            label: "Authentication Token",
            status: "error",
            message: "token is not configured. Set channels.pico.token on PicoClaw.",
        });
        return { status: "fail", checks };
    }
    checks.push({
        label: "Gateway URL",
        status: "info",
        message: `Target: ${config.gatewayUrl}`,
    });
    try {
        await new Promise((resolve, reject) => {
            let wsUrl = config.gatewayUrl;
            try {
                const parsed = new URL(wsUrl.startsWith("ws") ? wsUrl : `ws://${wsUrl}`);
                parsed.searchParams.set("session_id", "test-connection");
                wsUrl = parsed.toString();
            }
            catch {
                // Fallback if URL parsing fails
            }
            const ws = new WebSocket(wsUrl, [
                `token.${config.token}`,
            ]);
            const timer = setTimeout(() => {
                ws.close();
                reject(new Error("Connection timed out after 10s"));
            }, 10_000);
            ws.on("open", () => {
                clearTimeout(timer);
                checks.push({
                    label: "WebSocket Handshake",
                    status: "info",
                    message: "Connected and authenticated successfully.",
                });
                ws.close(1000);
                resolve();
            });
            ws.on("error", (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    catch (err) {
        const msg = err.message;
        checks.push({
            label: "Connection Test",
            status: "error",
            message: `Failed to connect: ${msg}`,
        });
        return { status: "fail", checks };
    }
    checks.push({
        label: "PicoClaw Gateway",
        status: "info",
        message: "Gateway is reachable and token is valid.",
    });
    return { status: "pass", checks };
}
