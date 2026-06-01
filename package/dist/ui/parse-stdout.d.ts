export interface TranscriptEntry {
    type: "text" | "status";
    content: string;
    timestamp?: number;
}
export declare function parseStdoutLine(line: string): TranscriptEntry[];
