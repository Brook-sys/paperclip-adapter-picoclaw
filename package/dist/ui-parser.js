exports.parseStdoutLine = function parseStdoutLine(line, ts) {
    const timestamp = ts || new Date().toISOString();
    const trimmed = line.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        
        // Se conseguimos parsear mas não tem .type ou não é picoclaw.*, mostramos info de depuração
        if (!parsed || typeof parsed !== "object") {
             return [{ kind: "system", text: "DEBUG: Parsed JSON is not an object: " + trimmed, ts: timestamp }];
        }
        
        if (!parsed.type) {
             return [{ kind: "system", text: "DEBUG: Parsed object lacks 'type': " + trimmed, ts: timestamp }];
        }

        switch (parsed.type) {
            case "picoclaw.typing":
                if (parsed.state === "start") {
                    return [
                        {
                            kind: "thinking",
                            text: "PicoClaw is thinking...",
                            ts: timestamp,
                        },
                    ];
                }
                return [];
            case "picoclaw.message":
                return [
                    {
                        kind: "assistant",
                        text: String(parsed.content ?? ""),
                        ts: timestamp,
                    },
                ];
            default:
                return [{ kind: "system", text: "DEBUG: Unhandled picoclaw type '" + parsed.type + "': " + trimmed, ts: timestamp }];
        }
    } catch (err) {
        // Se der erro de parse, exibimos como balão do sistema ao invés de stdout puro
        return [{ kind: "system", text: "DEBUG PARSE ERROR: " + String(err) + " | RAW LINE: " + trimmed, ts: timestamp }];
    }
};
