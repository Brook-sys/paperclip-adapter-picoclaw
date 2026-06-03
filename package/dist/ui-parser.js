function parsePicoclawLine(line, ts) {
    var timestamp = ts || new Date().toISOString();
    var trimmed = String(line || "").trim();
    if (!trimmed) return [];

    try {
        var parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.type) {
            switch (parsed.type) {
                case "picoclaw.typing":
                    if (parsed.state === "start") {
                        return [{ kind: "thinking", text: "PicoClaw is thinking...", ts: timestamp }];
                    }
                    return [];
                case "picoclaw.message":
                    return [{ kind: "assistant", text: String(parsed.content || ""), ts: timestamp }];
                default:
                    return [{ kind: "system", text: trimmed, ts: timestamp }];
            }
        }
    } catch (err) {
    }

    if (trimmed === "[PicoClaw is thinking...]" || trimmed === "PicoClaw is thinking...") {
        return [{ kind: "thinking", text: "PicoClaw is thinking...", ts: timestamp }];
    }

    if (trimmed.indexOf("[picoclaw]") === 0) {
        return [{ kind: "system", text: trimmed, ts: timestamp }];
    }

    if (trimmed.indexOf("[paperclip]") === 0) {
        return [{ kind: "system", text: trimmed, ts: timestamp }];
    }

    if (trimmed.indexOf("> [tool]") === 0 || trimmed.indexOf("[tool]") === 0) {
        return [{ kind: "system", text: trimmed, ts: timestamp }];
    }

    return [{ kind: "assistant", text: trimmed, ts: timestamp }];
}

function createPicoclawParser() {
    return {
        parseLine: parsePicoclawLine,
        reset: function reset() {}
    };
}

exports.parseStdoutLine = parsePicoclawLine;
exports.createStdoutParser = createPicoclawParser;
module.exports.parseStdoutLine = parsePicoclawLine;
module.exports.createStdoutParser = createPicoclawParser;
