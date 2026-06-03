export function parseStdoutLine(line, ts) {
    const timestamp = ts || new Date().toISOString();
    const trimmed = String(line || "").trim();
    if (!trimmed) return [];
    
    if (trimmed === "[PicoClaw is thinking...]" || trimmed === "PicoClaw is thinking...") {
        return [{ kind: "thinking", text: "PicoClaw is thinking...", ts: timestamp }];
    }
    if (trimmed.indexOf("[picoclaw]") === 0 || trimmed.indexOf("[paperclip]") === 0 || trimmed.indexOf("> [tool]") === 0 || trimmed.indexOf("[tool]") === 0) {
        return [{ kind: "system", text: trimmed, ts: timestamp }];
    }
    
    if (trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) === '}') {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && parsed.type) {
                if (parsed.type === "picoclaw.typing" && parsed.state === "start") {
                    return [{ kind: "thinking", text: "PicoClaw is thinking...", ts: timestamp }];
                } else if (parsed.type === "picoclaw.typing") {
                    return [];
                } else if (parsed.type === "picoclaw.message") {
                    return [{ kind: "assistant", text: String(parsed.content || ""), ts: timestamp }];
                }
                return [{ kind: "system", text: trimmed, ts: timestamp }];
            }
        } catch (e) {
            // fallthrough
        }
    }

    return [{ kind: "assistant", text: trimmed, ts: timestamp }];
}
