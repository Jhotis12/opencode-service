import { Plugin } from "@opencode/plugin";
import { HttpPlatformClient, createPlatformTools } from "./tools.ts";

export { HttpPlatformClient, createPlatformTools, type PlatformClient, type PlatformTool } from "./tools.ts";

/**
 * Registers the platform tool namespace inside OpenCode V2. The tools call the
 * platform HTTP API with a service token, so the agent can inspect and drive
 * workflows, sub-agents, notebooks and external databases.
 */
export default Plugin.define({
  id: "platform-tools",
  async setup(ctx) {
    const baseUrl = process.env.PLATFORM_API_URL ?? "http://127.0.0.1:3000";
    const token = process.env.PLATFORM_SERVICE_TOKEN ?? "";
    // OpenCode loads this plugin per location. A project location is scoped to
    // its own slug; the global orchestrator (outside /workspaces) stays unscoped.
    const projectSlug = /[\\/]workspaces[\\/]([^\\/]+)/.exec(ctx.location.directory)?.[1];
    console.log(`[platform-tools] location=${ctx.location.directory} scope=${projectSlug ?? "global"}`);
    const client = new HttpPlatformClient(baseUrl, token, projectSlug);
    const registration = await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "platform",
        description: "Controla la plataforma de automatizaciones agénticas (flujos, sub-agentes, notebooks, bases de datos y canales).",
      });
      for (const tool of createPlatformTools(client)) {
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
