export declare function listSkills(ctx: import("@paperclipai/adapter-utils").AdapterSkillContext): Promise<import("@paperclipai/adapter-utils").AdapterSkillSnapshot>;
export declare function syncSkills(ctx: import("@paperclipai/adapter-utils").AdapterSkillContext, desiredSkills: string[]): Promise<import("@paperclipai/adapter-utils").AdapterSkillSnapshot>;
export declare function readSelectedSkillPrompt(config: Record<string, unknown>): Promise<{ text: string; names: string[] }>;
