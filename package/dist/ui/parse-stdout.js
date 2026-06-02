export function parseStdoutLine(line, ts) {
    const trimmed = line.trim();
    if (!trimmed)
        return [];
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
                                ts,
                            },
                        ];
                    }
                    return [];
                case "picoclaw.message":
                    return [
                        {
                            kind: "assistant",
                            text: String(parsed.content ?? ""),
                            ts,
                        },
                    ];
                default:
                    return [{ kind: "system", text: "PARSER DEFAULT: Unknown type '" + parsed.type + "' in line: " + trimmed, ts }];
            }
        }
        return [{ kind: "system", text: "PARSER WARNING: Parsed object without .type in line: " + trimmed, ts }];
    }
    catch (e) {
        return [{ kind: "stderr", text: "PARSER CATCH ERROR (" + String(e) + "): " + trimmed, ts }];
    }
}
