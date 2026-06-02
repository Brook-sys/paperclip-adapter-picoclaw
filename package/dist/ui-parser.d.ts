export interface TranscriptEntry {
    kind: "stdout" | "stderr" | "system" | "assistant" | "thinking" | "tool_call" | "tool_result" | "result" | "init";
    ts: string;
    text?: string;
    delta?: boolean;
    [key: string]: unknown;
}
export declare function parseStdoutLine(line: string, ts: string): TranscriptEntry[];
