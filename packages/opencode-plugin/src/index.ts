import { Plugin } from "@opencode/plugin";
import { HttpPlatformClient, createPlatformTools } from "./tools.ts";

export { HttpPlatformClient, createPlatformTools, type PlatformClient, type PlatformTool } from "./tools.ts";

/**
 * Registers the platform tool namespace inside OpenCode V2. The tools call the
 * platform HTTP API with a scope-specific service token: project locations are
 * restricted to their own slug, while the control workspace receives global
 * read-only access.
 */
export default Plugin.define({
  id: "platform-tools",
  async setup(ctx) {
    const baseUrl = process.env.PLATFORM_API_URL ?? "http://127.0.0.1:3000";
    const projectSlug = /[\\/]workspaces[\\/]([^\\/]+)/.exec(ctx.location.directory)?.[1];
    const globalScope = !projectSlug;
    const token = globalScope
      ? process.env.PLATFORM_GLOBAL_TOKEN ?? process.env.PLATFORM_SERVICE_TOKEN ?? ""
      : process.env.PLATFORM_SERVICE_TOKEN ?? "";
    console.log(`[platform-tools] location=${ctx.location.directory} scope=${projectSlug ?? "global"}`);
    const scope = { projectSlug, global: globalScope };
    const client = new HttpPlatformClient(baseUrl, token, scope);
    const registration = await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "platform",
        description:
          "Controla la plataforma de automatizaciones agénticas (proyectos, flujos, agentes, conocimiento, integraciones y salud).",
      });
      for (const tool of createPlatformTools(client, scope)) {
        editor.add({
          name: tool.name,
          description: tool.description,
          input: tool.input,
          execute: tool.execute,
          options: { namespace: "platform" },
        });
      }
    });
    return async () => {
      await registration.dispose();
    };
  },
});
