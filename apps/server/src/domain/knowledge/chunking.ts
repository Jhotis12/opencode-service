export interface KnowledgeChunk {
  ordinal: number;
  section: string;
  content: string;
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

/** Splits markdown by heading, then packs paragraphs into overlapping chunks. */
export function chunkMarkdown(markdown: string, options: ChunkOptions = {}): KnowledgeChunk[] {
  const maxChars = options.maxChars ?? 2400;
  const overlapChars = options.overlapChars ?? 400;
  const sections: Array<{ title: string; text: string }> = [];
  let title = "Documento";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) sections.push({ title, text });
    buffer = [];
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      title = heading[2]!.trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  const chunks: KnowledgeChunk[] = [];
  let ordinal = 0;
  for (const section of sections) {
    if (section.text.length <= maxChars) {
      chunks.push({ ordinal: ordinal++, section: section.title, content: section.text });
      continue;
    }
    const paragraphs = section.text.split(/\n{2,}/).flatMap((paragraph) =>
      paragraph.length > maxChars ? splitLongText(paragraph, maxChars) : [paragraph],
    );
    let current = "";
    let previousTail = "";
    for (const paragraph of paragraphs) {
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
      if (candidate.length > maxChars && current) {
        chunks.push({ ordinal: ordinal++, section: section.title, content: `${previousTail}${current}`.trim() });
        previousTail = overlapChars > 0 ? `${current.slice(-overlapChars)}\n\n` : "";
        current = paragraph;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) {
      chunks.push({ ordinal: ordinal++, section: section.title, content: `${previousTail}${current}`.trim() });
    }
  }
  return chunks;
}

function splitLongText(text: string, maxChars: number): string[] {
  const pieces: string[] = [];
  for (let index = 0; index < text.length; index += maxChars) {
    pieces.push(text.slice(index, index + maxChars));
  }
  return pieces;
}

/** Extractive summary: leading sentences up to a bounded length. */
export function summarize(text: string, maxSentences = 5, maxChars = 700): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const selected: string[] = [];
  let length = 0;
  for (const sentence of sentences) {
    if (selected.length >= maxSentences || length + sentence.length > maxChars) break;
    selected.push(sentence);
    length += sentence.length;
  }
  return selected.join(" ").slice(0, maxChars);
}
