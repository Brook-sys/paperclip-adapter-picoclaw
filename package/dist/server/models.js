function parseConfiguredModels(config) {
    const raw = config.models ?? config.availableModels ?? config.modelIds;
    if (Array.isArray(raw)) {
        return raw.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof raw === "string") {
        return raw.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}
function modelLabel(id) {
    return id === "default" ? "PicoClaw Default (Configured in Gateway)" : id;
}
function buildModels(ids) {
    const unique = [...new Set(ids.length > 0 ? ids : ["default"])];
    return unique.map((id) => ({ id, label: modelLabel(id) }));
}
function deriveModelsUrl(gatewayUrl) {
    try {
        const url = new URL(gatewayUrl.startsWith("ws") ? gatewayUrl : `ws://${gatewayUrl}`);
        url.protocol = url.protocol === "wss:" ? "https:" : "http:";
        url.pathname = url.pathname.replace(/\/ws\/?$/, "").replace(/\/$/, "") + "/models";
        url.search = "";
        return url.toString();
    } catch {
        return null;
    }
}
async function fetchGatewayModels(config) {
    const url = deriveModelsUrl(String(config.gatewayUrl ?? ""));
    if (!url || typeof fetch !== "function")
        return [];
    try {
        const res = await fetch(url, {
            headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            return [];
        const data = await res.json();
        if (Array.isArray(data))
            return data.map((item) => typeof item === "string" ? item : item?.id).filter(Boolean);
        if (Array.isArray(data.models))
            return data.models.map((item) => typeof item === "string" ? item : item?.id).filter(Boolean);
        return [];
    } catch {
        return [];
    }
}
export async function listModels(config = {}) {
    const envModels = typeof process !== "undefined" ? String(process.env.PICOCLAW_MODELS ?? "") : "";
    const configured = parseConfiguredModels({ ...config, models: config.models ?? envModels });
    const discovered = await fetchGatewayModels(config);
    return buildModels([...configured, ...discovered]);
}
export async function refreshModels(config = {}) {
    return listModels(config);
}
export const modelProfiles = [
    {
        id: "default",
        label: "PicoClaw Default",
        description: "Use the model configured by the PicoClaw gateway.",
        modelId: "default",
    },
];
