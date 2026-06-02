import WebSocket from "ws";
import { randomUUID } from "crypto";
import { deserialize, serialize } from "./session.js";

function joinPromptSections(sections) {
    return sections.filter((s) => typeof s === "string" && s.trim().length > 0).join("\n\n");
}
function renderPaperclipWakePrompt(wake, options) {
    if (!wake || typeof wake !== "object") return "";
    const parts = [];
    if (options?.resumedSession) {
        parts.push("Paperclip Resume Delta:");
    } else {
        parts.push("Paperclip Wake Payload:");
    }
    if (wake.wakeReason) parts.push(`- Reason: ${wake.wakeReason}`);
    if (wake.wakeCommentId) parts.push(`- Comment: ${wake.wakeCommentId}`);
    return parts.length > 1 ? parts.join("\n") : "";
}

function buildRichPrompt(ctx) {
    const isResume = Boolean(deserialize(ctx.runtime.sessionParams));
    const wakePrompt = renderPaperclipWakePrompt(ctx.context.paperclipWake, { resumedSession: isResume });
    const taskContextNote = String(ctx.context.paperclipTaskMarkdown ?? "").trim();
    const sessionHandoffNote = String(ctx.context.paperclipSessionHandoffMarkdown ?? "").trim();
    const shouldUseResumeDeltaPrompt = isResume && wakePrompt.length > 0;
    const userInstruction = shouldUseResumeDeltaPrompt ? "" : String(ctx.renderedPrompt ?? "");
    let fallbackDirective = "";
    if (!wakePrompt && !userInstruction.trim()) {
        fallbackDirective = "Paperclip triggered an execution run. Please review your active issue or recent comments and take the next necessary action. If no action is needed, report that you are done.";
    }
    const constraints = [
        "IMPORTANT PICO-CLAW CONSTRAINTS FOR THIS RUN:",
        "1. If a tool execution fails, especially with security or permission blocks like 'Command blocked' or 'outside working dir', do not retry the same tool repeatedly.",
        "2. Accept the failure, stop the execution loop, and provide a clear explanation of the error directly to the user.",
        "3. Before you execute any tool, output a single short sentence explaining your intent to the user."
    ].join("\n");
    return joinPromptSections([
        fallbackDirective,
        wakePrompt,
        sessionHandoffNote,
        taskContextNote,
        userInstruction,
        constraints
    ]);
}
function resolveConfig(ctx) {
    const cfg = ctx.config;
    return {
        gatewayUrl: String(cfg.gatewayUrl ?? "ws://127.0.0.1:18790/pico"),
        token: String(cfg.token ?? ""),
        timeoutMs: Number(cfg.timeoutMs ?? 300_000),
        completionGraceMs: Number(cfg.completionGraceMs ?? 5000),
        sessionStrategy: String(cfg.sessionStrategy ?? "issue"),
        promptMode: String(cfg.promptMode ?? "compact"),
    };
}
function resolveSession(ctx, config) {
    const prev = deserialize(ctx.runtime.sessionParams);
    if (prev)
        return String(prev.sessionId);
    switch (config.sessionStrategy) {
        case "run":
            return `paperclip:run:${ctx.runId}`;
        case "issue":
            return `paperclip:issue:${ctx.agent.id}:${ctx.runtime.taskKey ?? ctx.runId}`;
        case "agent":
            return `paperclip:agent:${ctx.agent.id}`;
        case "fixed":
            return `paperclip:fixed:${ctx.agent.id}`;
        default:
            return `paperclip:run:${ctx.runId}`;
    }
}
const PICOCLAW_PING = "ping";
const PICOCLAW_PONG = "pong";
function truncateForLog(value, maxLength = 160) {
    const text = String(value ?? "");
    const redacted = text.replace(/(Bearer\s+)[a-zA-Z0-9_\-\.\~]+/gi, "$1***REDACTED***")
                         .replace(/(["']?(?:api_key|token|secret|password|auth)["']?\s*[:=]\s*["']?)[a-zA-Z0-9_\-\.\~]+/gi, "$1***REDACTED***");
    return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}
function toolCallDisplay(toolCall) {
    if (!toolCall || typeof toolCall !== "object")
        return "unknown tool";
    const name = String(toolCall.name ?? toolCall.function?.name ?? "unknown");
    const rawArgs = toolCall.arguments ?? toolCall.function?.arguments ?? toolCall.args ?? null;
    if (rawArgs == null)
        return name;
    let argsText;
    if (typeof rawArgs === "string") {
        argsText = rawArgs;
    }
    else {
        try {
            argsText = JSON.stringify(rawArgs);
        }
        catch {
            argsText = String(rawArgs);
        }
    }
    return `${name}(${truncateForLog(argsText)})`;
}
function toolCallKey(toolCall) {
    if (!toolCall || typeof toolCall !== "object")
        return "unknown";
    const name = String(toolCall.name ?? toolCall.function?.name ?? "unknown");
    const rawArgs = toolCall.arguments ?? toolCall.function?.arguments ?? toolCall.args ?? "";
    return `${name}:${typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs)}`;
}
function extractToolCalls(payload) {
    const calls = payload?.tool_calls ?? payload?.toolCalls ?? [];
    return Array.isArray(calls) ? calls : [];
}
function buildToolCallDiary(toolCall, attempt) {
    const action = toolCallDisplay(toolCall);
    return `[PicoClaw] Tentativa ${attempt}: executando ferramenta ${action}.`;
}
function buildSessionWebSocketUrl(gatewayUrl, sessionId) {
    const wsUrl = gatewayUrl.startsWith("ws") ? gatewayUrl : `ws://${gatewayUrl}`;
    const parsed = new URL(wsUrl);
    parsed.searchParams.set("session_id", sessionId);
    return parsed.toString();
}
async function picoclawExecute(config, prompt, sessionId, onLogStdout, onLogStderr) {
    const wsUrl = buildSessionWebSocketUrl(config.gatewayUrl, sessionId);
    const ws = new WebSocket(wsUrl, [`token.${config.token}`]);
    let accumulated = "";
    let done = false;
    let errorMsg = "";
    let toolAttempts = {};
    let messageBuffers = {};
    let lastAgentNarrationAt = 0;
    
    let completionGraceTimer = null;
    const cancelCompletionGrace = () => {
        if (completionGraceTimer) {
            clearTimeout(completionGraceTimer);
            completionGraceTimer = null;
        }
    };

    await new Promise((resolve, reject) => {
        const finalizeRun = () => {
            if (!done) {
                done = true;
                ws.close(1000);
                resolve();
            }
        };

        const flushMessageBuffer = async (messageId) => {
            const buffer = messageBuffers[messageId];
            if (!buffer || !buffer.content.trim())
                return;
            delete messageBuffers[messageId];
            accumulated = buffer.mode === "replace" ? buffer.content : accumulated + buffer.content;
            lastAgentNarrationAt = Date.now();
            await onLogStdout(JSON.stringify({ type: "picoclaw.message", content: buffer.content }) + "\n");
        };
        const scheduleMessageBuffer = (messageId, content, mode) => {
            if (!messageBuffers[messageId])
                messageBuffers[messageId] = { content: "", timer: null, mode };
            messageBuffers[messageId].content = content;
            messageBuffers[messageId].mode = mode;
            clearTimeout(messageBuffers[messageId].timer);
            messageBuffers[messageId].timer = setTimeout(() => {
                flushMessageBuffer(messageId).catch(async (err) => {
                    await onLogStderr(`picoclaw: could not flush message buffer: ${err.message}\n`);
                });
            }, 700);
        };
        let idleTimer;
        const resetIdleTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (!done) {
                    done = true;
                    ws.close(1000);
                    resolve();
                }
            }, config.timeoutMs);
        };
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "message.send",
                id: randomUUID(),
                session_id: sessionId,
                payload: { content: prompt },
            }));
            resetIdleTimer();
        });
        ws.on("message", async (data) => {
            try {
                resetIdleTimer();
                cancelCompletionGrace();
                const msg = JSON.parse(data.toString("utf-8"));
                switch (msg.type) {
                    case "message.create": {
                        const content = String(msg.payload?.content ?? "");
                        const msgId = msg.payload?.message_id || randomUUID();
                        if (content.trim()) {
                            scheduleMessageBuffer(msgId, content, "append");
                        }
                        else if (msg.payload?.kind === "tool_calls") {
                            const timeSinceLastNarration = Date.now() - lastAgentNarrationAt;
                            if (timeSinceLastNarration > 2500) {
                                const calls = extractToolCalls(msg.payload);
                                for (const call of calls) {
                                    const key = toolCallKey(call);
                                    toolAttempts[key] = (toolAttempts[key] || 0) + 1;
                                    const diaryMsg = buildToolCallDiary(call, toolAttempts[key]);
                                    await onLogStdout(JSON.stringify({ type: "picoclaw.message", content: diaryMsg }) + "\n");
                                }
                            }
                        }
                        break;
                    }
                    case "message.update": {
                        const content = String(msg.payload?.content ?? "");
                        const msgId = msg.payload?.message_id;
                        if (content.trim() && msgId) {
                            scheduleMessageBuffer(msgId, content, "replace");
                        }
                        break;
                    }
                    case "message.delete": {
                        accumulated = "";
                        break;
                    }
                    case "typing.start": {
                        await onLogStdout(JSON.stringify({ type: "picoclaw.typing", state: "start" }) + "\n");
                        break;
                    }
                    case "typing.stop": {
                        await onLogStdout(JSON.stringify({ type: "picoclaw.typing", state: "stop" }) + "\n");
                        if (!completionGraceTimer) {
                            completionGraceTimer = setTimeout(() => {
                                finalizeRun();
                            }, config.completionGraceMs);
                        }
                        break;
                    }
                    case "error": {
                        const errCode = String(msg.payload?.code ?? "unknown_error");
                        const errMsg = String(msg.payload?.message ?? "An error occurred on the server");
                        if (!done) {
                            done = true;
                            errorMsg = `picoclaw server error: ${errCode} - ${errMsg}`;
                            await onLogStderr(`picoclaw server error: ${errCode} - ${errMsg}\n`);
                            ws.close(1000);
                            reject(new Error(errorMsg));
                        }
                        break;
                    }
                    case PICOCLAW_PING: {
                        ws.send(JSON.stringify({ type: PICOCLAW_PONG }));
                        break;
                    }
                    default:
                        await onLogStderr(`picoclaw event ignored: ${msg.type}\n`);
                        break;
                }
            }
            catch {
                await onLogStderr(`picoclaw: could not parse message frame`);
            }
        });
        ws.on("error", async (err) => {
            errorMsg = err.message;
            await onLogStderr(`picoclaw: WebSocket error: ${err.message}`);
            if (!done) {
                done = true;
                reject(new Error(err.message));
            }
        });
        ws.on("close", () => {
            if (!done) {
                done = true;
                for (const msgId of Object.keys(messageBuffers)) {
                    clearTimeout(messageBuffers[msgId].timer);
                    if (messageBuffers[msgId].content.trim()) {
                        accumulated = messageBuffers[msgId].mode === "replace"
                            ? messageBuffers[msgId].content
                            : accumulated + messageBuffers[msgId].content;
                        onLogStdout(JSON.stringify({ type: "picoclaw.message", content: messageBuffers[msgId].content }) + "\n").catch(() => {});
                    }
                }
                if (errorMsg) {
                    reject(new Error(errorMsg));
                }
                else {
                    resolve();
                }
            }
        });
    });
    return accumulated;
}
export async function execute(ctx) {
    const config = resolveConfig(ctx);
    const sessionId = resolveSession(ctx, config);
    if (!config.token) {
        return {
            exitCode: null,
            signal: null,
            timedOut: false,
            errorMessage: "picoclaw: token is required",
            errorFamily: "auth",
        };
    }
    const prompt = config.promptMode === "compact"
        ? buildRichPrompt(ctx)
        : (ctx.renderedPrompt ?? "");
    await ctx.onLog("stderr", `[DEBUG] Paperclip final prompt length: ${prompt.length} chars.\n`);
    if (ctx.renderedPrompt) {
        await ctx.onLog("stderr", `[DEBUG] renderedPrompt preview: ${String(ctx.renderedPrompt).slice(0, 200).replace(/\n/g, ' ')}...\n`);
    }
    let timedOut = false;
    let accumulated = "";
    try {
        accumulated = await Promise.race([
            picoclawExecute(config, prompt, sessionId, async (chunk) => {
                await ctx.onLog("stdout", chunk);
            }, async (chunk) => {
                await ctx.onLog("stderr", chunk);
            }),
            new Promise((resolve) => setTimeout(() => {
                timedOut = true;
                resolve(accumulated);
            }, config.timeoutMs)),
        ]);
    }
    catch (err) {
        return {
            exitCode: 1,
            signal: null,
            timedOut: false,
            errorMessage: String(err.message),
            errorFamily: "transient_upstream",
            errorCode: "picoclaw_execution_failed",
        };
    }
    return {
        exitCode: timedOut ? 1 : 0,
        signal: null,
        timedOut,
        summary: accumulated.slice(0, 500),
        sessionParams: serialize({ sessionId }),
        sessionDisplayId: sessionId.slice(0, 36),
        billingType: "subscription",
    };
}
