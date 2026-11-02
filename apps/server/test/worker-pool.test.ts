import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunWorkerPoolAdapter } from "../src/infrastructure/out/worker-sandbox/bun-worker-pool.ts";
import { WorkerTimeoutError } from "../src/application/ports/worker.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function nodeFile(code: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "platform-worker-"));
  dirs.push(dir);
  const file = join(dir, "node.ts");
  await writeFile(file, code);
  return file;
}

const pool = new BunWorkerPoolAdapter();

describe("bun worker pool", () => {
  it("executes a code node and returns its output", async () => {
    const path = await nodeFile(`export default async function run(input: { n: number }) { return { doubled: input.n * 2 }; }`);
    const result = await pool.execute({ nodeId: "double", projectSlug: "ventas", codePath: path, input: { n: 21 }, timeoutMs: 5000 });
    expect(result.output).toEqual({ doubled: 42 });
  });

  it("reloads edited node code between executions", async () => {
    const path = await nodeFile(`export default async () => "first"`);
    expect((await pool.execute({ nodeId: "n", projectSlug: "ventas", codePath: path, input: null, timeoutMs: 5000 })).output).toBe("first");
    await writeFile(path, `export default async () => "second"`);
    expect((await pool.execute({ nodeId: "n", projectSlug: "ventas", codePath: path, input: null, timeoutMs: 5000 })).output).toBe("second");
  });

  it("captures logs emitted through ctx.log", async () => {
    const path = await nodeFile(
      `export default async function run(_input: unknown, ctx: any) { ctx.log("hola", { step: 1 }); return true; }`,
    );
    const result = await pool.execute({ nodeId: "n", projectSlug: "ventas", codePath: path, input: null, timeoutMs: 5000 });
    expect(result.logs[0]).toEqual({ message: "hola", fields: { step: 1 } });
  });

  it("proxies db calls to the parent without exposing secrets", async () => {
    const path = await nodeFile(
      `export default async function run(_input: unknown, ctx: any) { return await ctx.db("crm", "SELECT 1", []); }`,
    );
    const result = await pool.execute({
      nodeId: "n",
      projectSlug: "ventas",
      codePath: path,
      input: null,
      timeoutMs: 5000,
      handlers: { db: async ({ integrationId }) => [{ integrationId }] },
    });
    expect(result.output).toEqual([{ integrationId: "crm" }]);
  });

  it("rejects when the node throws", async () => {
    const path = await nodeFile(`export default async () => { throw new Error("boom"); }`);
    await expect(pool.execute({ nodeId: "n", projectSlug: "ventas", codePath: path, input: null, timeoutMs: 5000 })).rejects.toThrow("boom");
  });

  it("terminates a node that exceeds its timeout", async () => {
    const path = await nodeFile(`export default async () => { await new Promise(() => {}); return "never"; }`);
    await expect(pool.execute({ nodeId: "n", projectSlug: "ventas", codePath: path, input: null, timeoutMs: 150 })).rejects.toBeInstanceOf(
      WorkerTimeoutError,
    );
  });

  it("rejects when the node has no default export", async () => {
    const path = await nodeFile(`export const nope = 1;`);
    await expect(pool.execute({ nodeId: "n", projectSlug: "ventas", codePath: path, input: null, timeoutMs: 5000 })).rejects.toThrow(
      /default async function/,
    );
  });
});
