import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import { sessionCodec } from "./session.js";
import { agentConfigurationDoc, models } from "../index.js";
import { getConfigSchema } from "./config-schema.js";
export function createServerAdapter() {
    return {
        type: "picoclaw",
        execute,
        testEnvironment,
        sessionCodec,
        models,
        agentConfigurationDoc,
        getConfigSchema,
        supportsInstructionsBundle: true,
    };
}
