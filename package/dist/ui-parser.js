export function parseStdoutLine(line, ts) {
    const timestamp = ts || new Date().toISOString();
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
                    return [{ kind: "stdout", text: trimmed, ts: timestamp }];
            }
        }
        return [{ kind: "stdout", text: trimmed, ts: timestamp }];
    } catch {
        return [{ kind: "stdout", text: trimmed, ts: timestamp }];
    }
}
