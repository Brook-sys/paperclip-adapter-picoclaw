export interface TranscriptEntry {
    kind: "stdout" | "stderr" | "system" | "assistant" | "thinking" | "tool_call" | "tool_result" | "result";
    text?: string;
    ts?: string;
    [key: string]: any;
}
export declare function parseStdoutLine(line: string, ts?: string): TranscriptEntry[];
