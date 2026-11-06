import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AudioConversionError, type AudioConverterPort } from "../../../application/ports/audio.ts";

const EXTENSION: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/flac": "flac",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
};

export class FfmpegAudioConverter implements AudioConverterPort {
  async toOpus(input: { bytes: Uint8Array; mime: string }): Promise<{ bytes: Uint8Array; durationSeconds?: number }> {
    const directory = await mkdtemp(join(tmpdir(), "platform-audio-"));
    const extension = EXTENSION[input.mime] ?? "audio";
    const inputPath = join(directory, `input.${extension}`);
    const outputPath = join(directory, "output.ogg");
    try {
      await writeFile(inputPath, input.bytes, { mode: 0o600 });
      const encoded = Bun.spawn(
        [
          "ffmpeg",
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          inputPath,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "48000",
          "-c:a",
          "libopus",
          "-b:a",
          "48k",
          "-f",
          "ogg",
          outputPath,
        ],
        { stdout: "ignore", stderr: "pipe" },
      );
      if ((await encoded.exited) !== 0) {
        const stderr = await new Response(encoded.stderr).text().catch(() => "");
        throw new AudioConversionError(`ffmpeg failed${stderr ? `: ${stderr.slice(0, 200)}` : ""}`);
      }
      const duration = await this.duration(inputPath);
      return { bytes: new Uint8Array(await readFile(outputPath)), ...(duration ? { durationSeconds: duration } : {}) };
    } catch (error) {
      if (error instanceof AudioConversionError) throw error;
      throw new AudioConversionError(error instanceof Error ? error.message : String(error));
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async duration(path: string): Promise<number | undefined> {
    const probe = Bun.spawn(
      ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
      { stdout: "pipe", stderr: "ignore" },
    );
    if ((await probe.exited) !== 0) return undefined;
    const value = Number((await new Response(probe.stdout).text()).trim());
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
}
