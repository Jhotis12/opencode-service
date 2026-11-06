import { describe, expect, it } from "bun:test";
import { FfmpegAudioConverter } from "../src/infrastructure/out/audio/ffmpeg-audio-converter.ts";

function wav(seconds = 0.3, rate = 8_000): Uint8Array {
  const samples = Math.floor(rate * seconds);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin((index / rate) * Math.PI * 440) * 8_000), 44 + index * 2);
  }
  return new Uint8Array(buffer);
}

describe("ffmpeg audio converter", () => {
  it.skipIf(Bun.which("ffmpeg") === null)("converts audio to OGG/Opus and reports its duration", async () => {
    const result = await new FfmpegAudioConverter().toOpus({ bytes: wav(), mime: "audio/wav" });
    expect(String.fromCharCode(...result.bytes.slice(0, 4))).toBe("OggS");
    expect(result.durationSeconds).toBeGreaterThan(0.2);
    expect(result.durationSeconds).toBeLessThan(0.6);
  });

  it.skipIf(Bun.which("ffmpeg") === null)("rejects invalid audio with an actionable error", async () => {
    await expect(
      new FfmpegAudioConverter().toOpus({ bytes: new Uint8Array([1, 2, 3]), mime: "audio/mpeg" }),
    ).rejects.toThrow(/ffmpeg failed/);
  });
});
