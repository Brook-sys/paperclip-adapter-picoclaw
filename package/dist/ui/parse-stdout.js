export function parseStdoutLine(line) {
    const trimmed = line.trim();
    if (!trimmed)
        return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.type) {
            switch (parsed.type) {
                case "picoclaw.typing":
                    return [
                        {
                            type: "status",
                            content: parsed.state === "start"
                                ? "[PicoClaw] thinking..."
                                : "[PicoClaw] done",
                        },
                    ];
                case "picoclaw.message":
                    return [
                        {
                            type: "text",
                            content: String(parsed.content ?? ""),
                        },
                    ];
                default:
                    return [{ type: "text", content: trimmed }];
            }
        }
    }
    catch {
        // not JSON, treat as raw text
    }
    return [{ type: "text", content: trimmed }];
}
