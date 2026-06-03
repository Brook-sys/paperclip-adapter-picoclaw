"use strict";
var parsePicoclawLine = function (line, ts) {
    var timestamp = ts || new Date().toISOString();
    var trimmed = String(line || "").trim();
    if (!trimmed) return [];
    
    // Tratamento estático do log puro sem exceções complexas
    if (trimmed === "[PicoClaw is thinking...]" || trimmed === "PicoClaw is thinking...") {
        return [{ kind: "thinking", text: "PicoClaw is thinking...", ts: timestamp }];
    }
    if (trimmed.indexOf("[picoclaw]") === 0 || trimmed.indexOf("[paperclip]") === 0 || trimmed.indexOf("> [tool]") === 0 || trimmed.indexOf("[tool]") === 0) {
        return [{ kind: "system", text: trimmed, ts: timestamp }];
    }
    
    // Fallback JSON (legacy payload mode)
    if (trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) === '}') {
        try {
            var parsed = JSON.parse(trimmed);
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
};

exports.parseStdoutLine = parsePicoclawLine;
module.exports.parseStdoutLine = parsePicoclawLine;

