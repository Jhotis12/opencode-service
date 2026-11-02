import type { KnowledgeExtractor } from "../../../application/ports/knowledge.ts";

export class KnowledgeError extends Error {
  constructor(
    public readonly code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EXTRACTION_FAILED" | "UNSAFE_URL",
    message: string,
  ) {
    super(message);
    this.name = "KnowledgeError";
  }
}

const ALLOWED_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".csv", ".pdf", ".docx"]);
const MAX_BYTES = 20 * 1024 * 1024;

export class DocumentExtractor implements KnowledgeExtractor {
  constructor(private readonly maxBytes = MAX_BYTES) {}

  async extract(input: { filename: string; mime?: string; bytes: Uint8Array }): Promise<{ markdown: string; kind: string }> {
    if (input.bytes.byteLength > this.maxBytes) {
      throw new KnowledgeError("TOO_LARGE", `file exceeds ${this.maxBytes} bytes`);
    }
    const extension = extensionOf(input.filename);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new KnowledgeError("UNSUPPORTED_TYPE", `unsupported file type: ${extension || input.filename}`);
    }
    try {
      switch (extension) {
        case ".pdf":
          return { markdown: await extractPdf(input.bytes), kind: "pdf" };
        case ".docx":
          return { markdown: await extractDocx(input.bytes), kind: "docx" };
        case ".csv":
          return { markdown: csvToMarkdown(new TextDecoder().decode(input.bytes)), kind: "csv" };
        case ".md":
        case ".markdown":
          return { markdown: new TextDecoder().decode(input.bytes), kind: "markdown" };
        default:
          return { markdown: new TextDecoder().decode(input.bytes), kind: "text" };
      }
    } catch (error) {
      if (error instanceof KnowledgeError) throw error;
      throw new KnowledgeError("EXTRACTION_FAILED", `could not extract ${input.filename}: ${(error as Error).message}`);
    }
  }
}

function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(bytes, { mergePages: false });
  return result.text.map((page, index) => `## Página ${index + 1}\n\n${page.trim()}`).join("\n\n");
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

function csvToMarkdown(text: string): string {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 2000)
    .map((line) => line.split(",").map((cell) => cell.trim().replaceAll("|", "\\|")));
  if (rows.length === 0) return "";
  const [header, ...body] = rows as [string[], ...string[][]];
  const separator = header.map(() => "---");
  return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<h1[^>]*>/gi, "# ")
    .replace(/<h2[^>]*>/gi, "## ")
    .replace(/<h3[^>]*>/gi, "### ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
