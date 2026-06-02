// FORCE CACHE BUST: 2026-06-02-B
exports.parseStdoutLine = function parseStdoutLine(line, ts) {
    const trimmed = line.trim();
    if (!trimmed) return [];
    
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.type) {
            switch (parsed.type) {
                case "picoclaw.typing":
                    if (parsed.state === "start") {
                        return [
                            {
                                kind: "thinking",
                                text: "PicoClaw is thinking...",
                                ts: ts || new Date().toISOString(),
                            }
                        ];
                    }
                    return [];
                case "picoclaw.message":
                    return [
                        {
                            kind: "assistant",
                            text: String(parsed.content ?? ""),
                            ts: ts || new Date().toISOString(),
                        }
                    ];
                default:
                    return [{ kind: "system", text: "PARSER DEFAULT: Unknown type '" + parsed.type + "' in line: " + trimmed, ts: ts || new Date().toISOString() }];
            }
        }
        return [{ kind: "system", text: "PARSER WARNING: Parsed object without .type in line: " + trimmed, ts: ts || new Date().toISOString() }];
    } catch (e) {
        return [{ kind: "stderr", text: "PARSER CATCH ERROR (" + String(e) + "): " + trimmed, ts: ts || new Date().toISOString() }];
    }
};
