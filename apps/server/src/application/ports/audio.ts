export class AudioConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioConversionError";
  }
}

export interface AudioConverterPort {
  toOpus(input: { bytes: Uint8Array; mime: string }): Promise<{ bytes: Uint8Array; durationSeconds?: number }>;
}
