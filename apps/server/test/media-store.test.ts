import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsMediaStore, detectMediaType } from "../src/infrastructure/out/media/fs-media-store.ts";
import { MEDIA_MAX_BYTES, MediaStoreError } from "../src/application/ports/media.ts";
import type { MediaRef } from "@platform/shared";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-media-"));
  dirs.push(dir);
  const store = new FsMediaStore({
    workspacesDir: join(dir, "workspaces"),
    controlDirectory: join(dir, "control"),
  });
  return { dir, store };
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);

describe("media store", () => {
  it("detects supported image and audio types by content", () => {
    expect(detectMediaType(jpeg)?.mime).toBe("image/jpeg");
    expect(detectMediaType(ogg)?.mime).toBe("audio/ogg");
    expect(detectMediaType(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
  });

  it("stores project media with a hashed path and restrictive permissions", async () => {
    const { dir, store } = await setup();
    const ref = await store.save({
      scope: "project",
      projectSlug: "ventas",
      filename: "../../foto rara.jpg",
      mime: "image/jpeg",
      bytes: jpeg,
    });
    expect(ref.kind).toBe("image");
    expect(ref.path).toMatch(/^\.opencode\/media\/[a-f0-9]{64}\.jpg$/);
    expect(ref.filename).toBe("foto_rara.jpg");
    const absolute = await store.resolve({ scope: "project", projectSlug: "ventas", media: ref });
    expect(absolute).toContain(join(dir, "workspaces", "ventas", ".opencode", "media"));
    expect((await stat(absolute)).mode & 0o777).toBe(0o600);
    expect(await readFile(absolute)).toEqual(Buffer.from(jpeg));
  });

  it("deduplicates identical content and supports global media", async () => {
    const { dir, store } = await setup();
    const first = await store.save({ scope: "project", projectSlug: "ventas", bytes: jpeg });
    const second = await store.save({ scope: "project", projectSlug: "ventas", bytes: jpeg });
    expect(second.path).toBe(first.path);
    const global = await store.save({ scope: "global", bytes: ogg, durationSeconds: 3 });
    expect(global.kind).toBe("audio");
    expect(global.durationSeconds).toBe(3);
    expect(await store.resolve({ scope: "global", media: global })).toContain(join(dir, "control", ".opencode", "media"));
  });

  it("rejects unsupported types, oversized files, and unsafe paths", async () => {
    const { dir, store } = await setup();
    await expect(
      store.save({ scope: "project", projectSlug: "ventas", bytes: new Uint8Array([1, 2, 3, 4]) }),
    ).rejects.toBeInstanceOf(MediaStoreError);
    await expect(
      store.save({ scope: "project", projectSlug: "ventas", bytes: new Uint8Array(MEDIA_MAX_BYTES + 1) }),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
    const ref: MediaRef = {
      kind: "image",
      path: "../outside.jpg",
      mime: "image/jpeg",
    };
    await expect(store.resolve({ scope: "project", projectSlug: "ventas", media: ref })).rejects.toMatchObject({
      code: "UNSAFE_PATH",
    });
    await expect(
      store.resolve({
        scope: "project",
        projectSlug: "ventas",
        media: { ...ref, path: `.opencode/media/../../${join(dir, "escape.jpg")}` },
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_PATH" });
    await expect(
      store.resolve({
        scope: "project",
        projectSlug: "ventas",
        media: { ...ref, path: ".opencode/media/missing.jpg" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const saved = await store.save({ scope: "project", projectSlug: "ventas", bytes: jpeg });
    await expect(
      store.resolve({ scope: "project", projectSlug: "soporte", media: saved }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(store.resolve({ scope: "project", media: ref })).rejects.toMatchObject({ code: "UNSAFE_PATH" });
  });
});
