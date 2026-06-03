import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import { sessionCodec } from "./session.js";
import { agentConfigurationDoc, models as staticModels } from "../index.js";
import { getConfigSchema } from "./config-schema.js";
import { listSkills, syncSkills } from "./skills.js";
import { listModels, refreshModels, modelProfiles } from "./models.js";

export function createServerAdapter() {
    return {
        type: "picoclaw",
        execute,
        testEnvironment,
        sessionCodec,
        models: staticModels,
        agentConfigurationDoc,
        getConfigSchema,
        listSkills,
        syncSkills,
        listModels: async () => listModels({}),
        refreshModels: async () => refreshModels({}),
        modelProfiles,
        supportsInstructionsBundle: true,
        supportsLocalAgentJwt: true, // Libera ferramentas de auth do Paperclip se o Gateway permitir
    };
}
