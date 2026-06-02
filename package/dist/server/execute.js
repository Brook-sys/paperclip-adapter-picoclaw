import WebSocket from "ws";
import { randomUUID } from "crypto";
import { deserialize, serialize } from "./session.js";
function buildCompactPrompt(ctx) {
    const taskKey = ctx.runtime.taskKey ?? "";
    const agentName = ctx.agent.name;
    const parts = [];
    parts.push(`You are being called by Paperclip as agent **${agentName}**.\n`);
    if (taskKey)
        parts.push(`Task reference: ${taskKey}\n`);
    parts.push(`Paperclip run ID: ${ctx.runId}\n`);
    parts.push("Complete the following task using your available tools and workspace.\n");
    
    parts.push("CRITICAL RULES:\n");
    parts.push("1. If a tool execution fails (especially with security/permission blocks like 'Command blocked' or 'outside working dir'), DO NOT attempt to retry the same tool repeatedly.\n");
    parts.push("2. Accept the failure, stop the execution loop, and provide a clear explanation of the error directly to the user.\n");
    parts.push("3. DIARY MODE: Before you execute any tool, you MUST output a single short sentence explaining your intent to the user (e.g. 'I will try to create the folder...', or 'Execution failed, I will try an alternative approach...'). Think out loud before calling tools.\n");
    
    parts.push("When finished, summarize the changes made.\n\n");
    parts.push(ctx.renderedPrompt ?? "");
    return parts.join("");
}
function resolveConfig(ctx) {
    const cfg = ctx.config;
    return {
        gatewayUrl: String(cfg.gatewayUrl ?? "ws://127.0.0.1:18790/pico"),
        token: String(cfg.token ?? ""),
        timeoutMs: Number(cfg.timeoutMs ?? 300_000),
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
    // Redact obvious secrets
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
    
    // Fallback dictionary to track tool call attempts
    let toolAttempts = {};
    let messageBuffers = {};
    let lastAgentNarrationAt = 0;

    await new Promise((resolve, reject) => {
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
                const msg = JSON.parse(data.toString("utf-8"));

                switch (msg.type) {
                    case "message.create": {
                        const content = String(msg.payload?.content ?? "");
                        const msgId = msg.payload?.message_id || randomUUID();
                        if (content.trim()) {
                            scheduleMessageBuffer(msgId, content, "append");
                        } else if (msg.payload?.kind === "tool_calls") {
                            // Empty tool_call message fallback: construct diagnostic diary
                            const timeSinceLastNarration = Date.now() - lastAgentNarrationAt;
                            // Only output detailed fallback if agent didn't speak in the last 2.5 seconds
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
                        // We intentionally do not duplicate the diary for message.update 
                        // to avoid spamming the UI for each delta of tool_calls stream.
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
                        // We intentionally DO NOT close the socket here anymore.
                        // We let the idleTimer (or a server close) handle the completion
                        // because PicoClaw may send typing.stop *before* finishing its message updates.
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
        ? buildCompactPrompt(ctx)
        : (ctx.renderedPrompt ?? "");
    if (!prompt.trim()) {
        await ctx.onLog("stdout", "Skipped execution: prompt content is empty.\n");
        return {
            exitCode: 0,
            signal: null,
            timedOut: false,
            summary: "Skipped: empty prompt.",
            sessionParams: serialize({ sessionId }),
            sessionDisplayId: sessionId.slice(0, 36),
            billingType: "subscription",
        };
    }
    const start = Date.now();
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
