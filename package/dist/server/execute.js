import WebSocket from "ws";
import { randomUUID } from "crypto";
import { deserialize, serialize } from "./session.js";
import { readSelectedSkillPrompt } from "./skills.js";
function joinPromptSections(sections) {
    return sections.filter((s) => typeof s === "string" && s.trim().length > 0).join("\n\n");
}
function renderPaperclipWakePrompt(wake, options) {
    if (!wake || typeof wake !== "object")
        return "";
    const parts = [];
    if (options?.resumedSession) {
        parts.push("Paperclip Resume Delta:");
    }
    else {
        parts.push("Paperclip Wake Payload:");
    }
    if (wake.wakeReason)
        parts.push(`- Reason: ${wake.wakeReason}`);
    if (wake.wakeCommentId)
        parts.push(`- Comment: ${wake.wakeCommentId}`);
    return parts.length > 1 ? parts.join("\n") : "";
}
function buildRichPrompt(ctx, skillPrompt) {
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
        skillPrompt,
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
    const name = String(toolCall?.name ?? "tool_call").trim() || "tool_call";
    const args = toolCall?.arguments ?? {};
    const argsStr = typeof args === "string"
        ? args.trim()
        : Object.keys(args).length > 0 ? JSON.stringify(args) : "";
    return argsStr ? `${name}(${truncateForLog(argsStr)})` : `${name}()`;
}
function extractToolCalls(payload) {
    const calls = [];
    if (!payload || typeof payload !== "object")
        return calls;
    
    const tryPush = (arr) => {
        if (!Array.isArray(arr)) return;
        for (const rawCall of arr) {
            if (rawCall.function && typeof rawCall.function === "object") {
                calls.push({
                    id: rawCall.id || null,
                    name: rawCall.function.name ?? rawCall.name,
                    arguments: rawCall.function.arguments ?? rawCall.arguments
                });
            } else {
                calls.push({
                    id: rawCall.id || null,
                    name: rawCall.name,
                    arguments: rawCall.arguments
                });
            }
        }
    };

    if (payload.tool_calls) {
        tryPush(payload.tool_calls);
    }
    
    if (Array.isArray(payload.choices)) {
        for (const choice of payload.choices) {
            if (choice?.delta?.tool_calls) {
                tryPush(choice.delta.tool_calls);
            }
            if (choice?.message?.tool_calls) {
                tryPush(choice.message.tool_calls);
            }
        }
    }
    return calls;
}
function toolCallKey(toolCall) {
    if (toolCall?.id) return toolCall.id;
    const name = String(toolCall?.name ?? "unknown").trim();
    return name;
}
function buildToolCallDiary(toolCall, attempt) {
    const callStr = toolCallDisplay(toolCall);
    if (attempt > 1) {
        return `[tool] ${callStr}`;
    }
    return `[tool] calling ${callStr}...`;
}
export async function execute(ctx) {
    const config = resolveConfig(ctx);
    const skillData = await readSelectedSkillPrompt(ctx.config);
    const skillPrompt = skillData.text;
    const prompt = config.promptMode === "full"
        ? joinPromptSections([skillPrompt, ctx.renderedPrompt])
        : buildRichPrompt(ctx, skillPrompt);
    const sessionId = resolveSession(ctx, config);
    const onLogStdout = async (chunk) => {
        await ctx.onLog("stdout", chunk);
    };
    const onLogStderr = async (chunk) => {
        await ctx.onLog("stderr", chunk);
    };
    
    // Teste e validação visível:
    if (skillData.names.length > 0) {
        await onLogStdout(`[picoclaw-skills] Injected skills into prompt: ${skillData.names.join(", ")}\n`);
    } else {
        await onLogStdout(`[picoclaw-skills] No skills injected.\n`);
    }
    if (typeof ctx.onRuntimeParams === "function") {
        await ctx.onRuntimeParams({
            sessionId,
            gatewayUrl: config.gatewayUrl,
        });
    } else if (typeof ctx.onMeta === "function") {
        await ctx.onMeta({
            adapterType: "picoclaw",
            command: "picoclaw-gateway",
            commandNotes: [
                `Gateway: ${config.gatewayUrl}`,
                `Session: ${sessionId}`
            ]
        });
    }
    let done = false;
    let accumulated = "";
    let errorMsg = null;
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
    await new Promise(async (resolve, reject) => {
        let wsUrl = config.gatewayUrl;
        try {
            const parsed = new URL(wsUrl.startsWith("ws") ? wsUrl : `ws://${wsUrl}`);
            parsed.searchParams.set("session_id", sessionId);
            wsUrl = parsed.toString();
        } catch {
        }
        await onLogStdout(`[picoclaw] connecting to ${wsUrl.replace(/([?&]session_id=)[^&]+/, "$1[REDACTED]")}\n`);
        const ws = new WebSocket(wsUrl, [`token.${config.token}`], {
            handshakeTimeout: Math.min(config.timeoutMs, 30_000),
            headers: {
                Authorization: `Bearer ${config.token}`,
            },
        });
        const finalizeRun = () => {
            if (!done) {
                done = true;
                ws.close(1000);
                resolve();
            }
        };
        const armCompletionGrace = () => {
            if (!completionGraceTimer) {
                completionGraceTimer = setTimeout(() => {
                    finalizeRun();
                }, config.completionGraceMs);
            }
        };
        const flushMessageBuffer = async (messageId) => {
            const buffer = messageBuffers[messageId];
            if (!buffer || !buffer.content.trim())
                return;
            delete messageBuffers[messageId];
            accumulated = buffer.mode === "replace" ? buffer.content : accumulated + buffer.content;
            lastAgentNarrationAt = Date.now();
            await onLogStdout(buffer.content + "\n");
            armCompletionGrace();
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
                    errorMsg = "picoclaw: Connection timed out or agent took too long to respond.";
                    ws.close(1000);
                    reject(new Error(errorMsg));
                }
            }, config.timeoutMs);
        };
        resetIdleTimer(); // <-- Armar o timer no instante zero para prevenir hang de handshake
        let pingInterval;
        ws.on("open", async () => {
            const payload = {
                type: "message.send",
                id: randomUUID(),
                session_id: sessionId,
                payload: { content: prompt },
            };
            ws.send(JSON.stringify(payload));
            resetIdleTimer();
            pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 30000);
        });
        ws.on("message", async (data) => {
            try {
                const msg = JSON.parse(data.toString("utf-8"));
                if (msg.type === PICOCLAW_PONG) {
                    return;
                }
                if (msg.type === PICOCLAW_PING) {
                    ws.send(JSON.stringify({ type: PICOCLAW_PONG }));
                    return;
                }

                resetIdleTimer();
                cancelCompletionGrace();
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
                                    if (!call.name && Object.keys(msg.payload).length > 0) {
                                        await onLogStderr(`[debug] raw tool payload: ${JSON.stringify(msg.payload)}\n`);
                                    }
                                    const key = toolCallKey(call);
                                    toolAttempts[key] = (toolAttempts[key] || 0) + 1;
                                    const diaryMsg = buildToolCallDiary(call, toolAttempts[key]);
                                    
                                    if (toolAttempts[key] === 1) {
                                        await onLogStdout(`> ${diaryMsg}\n`);
                                    }
                                }
                                lastAgentNarrationAt = Date.now();
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
                        await onLogStdout("[PicoClaw is thinking...]\n");
                        break;
                    }
                    case "typing.stop": {
                        armCompletionGrace();
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
            catch (err) {
                if (!done) {
                    done = true;
                    errorMsg = err.message;
                    await onLogStderr(`picoclaw: WebSocket error: ${err.message}`);
                    ws.close(1000);
                    reject(new Error(err.message));
                }
            }
        });
        ws.on("unexpected-response", async (req, res) => {
            if (!done) {
                done = true;
                errorMsg = `picoclaw: unexpected response HTTP ${res.statusCode} ${res.statusMessage}`;
                await onLogStderr(`${errorMsg}\n`);
                ws.close(1000);
                reject(new Error(errorMsg));
            }
        });
        ws.on("close", async (code, reason) => {
            clearInterval(pingInterval);
            const reasonStr = reason ? reason.toString() : "No reason provided";
            await onLogStdout(`[picoclaw] connection closed: ${code} - ${reasonStr}\n`);
            if (!done) {
                for (const msgId of Object.keys(messageBuffers)) {
                    clearTimeout(messageBuffers[msgId].timer);
                    if (messageBuffers[msgId].content.trim()) {
                        accumulated = messageBuffers[msgId].mode === "replace"
                            ? messageBuffers[msgId].content
                            : accumulated + messageBuffers[msgId].content;
                        onLogStdout(messageBuffers[msgId].content + "\n").catch(() => { });
                    }
                }
                if (errorMsg) {
                    reject(new Error(errorMsg));
                }
                else {
                    resolve();
                }
            }
            clearTimeout(idleTimer);
            cancelCompletionGrace();
        });
        ws.on("error", async (err) => {
            clearInterval(pingInterval);
            if (!done) {
                done = true;
                errorMsg = err.message;
                await onLogStderr(`picoclaw socket error: ${err.message}\n`);
                ws.close(1000);
                reject(err);
            }
        });
    });
    return {
        completed: true,
        summary: accumulated.trim() || "PicoClaw completed the execution without returning a message.",
        data: {
            mode: config.promptMode,
        },
    };
}
