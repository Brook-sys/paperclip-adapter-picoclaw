import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    readPaperclipRuntimeSkillEntries,
    readPaperclipSkillMarkdown,
    resolvePaperclipDesiredSkillNames,
    writePaperclipSkillSyncPreference,
} from "@paperclipai/adapter-utils/server-utils";
const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
export async function listSkills(ctx) {
    return buildPicoClawSkillSnapshot(ctx.config);
}
export async function syncSkills(ctx, desiredSkills) {
    writePaperclipSkillSyncPreference(ctx.config, desiredSkills);
    const availableEntries = await readPaperclipRuntimeSkillEntries(ctx.config, __moduleDir);
    return buildPicoClawSkillSnapshot({
        ...ctx.config,
        paperclipSkillSync: {
            desiredSkills,
        },
    }, availableEntries);
}
export async function readSelectedSkillPrompt(config) {
    const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
    const desiredSkills = resolvePaperclipDesiredSkillNames(config, availableEntries);
    const desired = new Set(desiredSkills);
    const sections = [];
    for (const entry of availableEntries) {
        if (!desired.has(entry.key) && !entry.required)
            continue;
        const markdown = await readPaperclipSkillMarkdown(__moduleDir, entry.key);
        if (!markdown || !markdown.trim())
            continue;
        sections.push(`Skill: ${entry.runtimeName || entry.key}\n\n${markdown.trim()}`);
    }
    if (sections.length === 0)
        return "";
    return [
        "Paperclip Skills enabled for this run:",
        "Use the following skill instructions when relevant.",
        sections.join("\n\n---\n\n"),
    ].join("\n\n");
}
async function buildPicoClawSkillSnapshot(config, availableEntries) {
    const entries = availableEntries ?? await readPaperclipRuntimeSkillEntries(config, __moduleDir);
    const desiredSkills = resolvePaperclipDesiredSkillNames(config, entries);
    const desired = new Set(desiredSkills);
    return {
        adapterType: "picoclaw",
        supported: true,
        mode: "virtual",
        desiredSkills,
        entries: entries.map((entry) => ({
            key: entry.key,
            runtimeName: entry.runtimeName ?? entry.key,
            desired: desired.has(entry.key) || entry.required === true,
            managed: false,
            required: entry.required === true,
            requiredReason: entry.requiredReason ?? null,
            state: desired.has(entry.key) || entry.required === true ? "linked" : "missing",
            origin: entry.origin,
            originLabel: entry.originLabel ?? null,
            locationLabel: "Injected into PicoClaw prompt",
            readOnly: false,
            sourcePath: entry.source ?? null,
            targetPath: null,
            detail: "PicoClaw receives this Paperclip skill as prompt context instead of a local filesystem install.",
        })),
        warnings: [],
    };
}
