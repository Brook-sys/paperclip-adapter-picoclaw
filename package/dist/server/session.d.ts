export interface SessionParams {
    sessionId: string;
}
export declare function serialize(params: Record<string, unknown> | null): Record<string, unknown> | null;
export declare function deserialize(raw: unknown): Record<string, unknown> | null;
export declare function getDisplayId(params: Record<string, unknown> | null): string | null;
export declare const sessionCodec: {
    serialize: typeof serialize;
    deserialize: typeof deserialize;
    getDisplayId: typeof getDisplayId;
};
