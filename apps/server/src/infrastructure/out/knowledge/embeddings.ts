import type { EmbeddingPort } from "../../../application/ports/knowledge.ts";

const DIMENSIONS = 256;

/** Deterministic lexical vectors: a working fallback when no embeddings API is configured. */
export class HashEmbeddingAdapter implements EmbeddingPort {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.vector(text));
  }

  private vector(text: string): number[] {
    const vector = new Array<number>(DIMENSIONS).fill(0);
    const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 1);
    for (const token of tokens) {
      vector[fnv1a(token) % DIMENSIONS] += 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
  }
}

export class HttpEmbeddingAdapter implements EmbeddingPort {
  constructor(
    private readonly url: string,
    private readonly apiKey: string | undefined,
    private readonly model: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: this.model, input: texts }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`embeddings provider returned ${response.status}`);
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    if (!Array.isArray(payload.data) || payload.data.length !== texts.length) {
      throw new Error("embeddings provider returned an unexpected payload");
    }
    return payload.data.map((item) => {
      if (!Array.isArray(item.embedding) || item.embedding.length === 0) throw new Error("missing embedding vector");
      return item.embedding;
    });
  }
}

export function createEmbeddingAdapter(env: Record<string, string | undefined> = process.env): EmbeddingPort {
  if (env.EMBEDDINGS_URL) {
    return new HttpEmbeddingAdapter(env.EMBEDDINGS_URL, env.EMBEDDINGS_API_KEY, env.EMBEDDINGS_MODEL ?? "text-embedding-3-small");
  }
  return new HashEmbeddingAdapter();
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    normA += a[index]! * a[index]!;
    normB += b[index]! * b[index]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
