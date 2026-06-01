const SESSION_VERSION = 1;
export function serialize(params) {
    if (!params)
        return null;
    return {
        v: SESSION_VERSION,
        sessionId: params.sessionId,
    };
}
export function deserialize(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return null;
    const data = raw;
    if (typeof data.sessionId !== "string")
        return null;
    return { sessionId: data.sessionId };
}
export function getDisplayId(params) {
    if (!params)
        return null;
    return String(params.sessionId ?? "").slice(0, 12);
}
export const sessionCodec = { serialize, deserialize, getDisplayId };
